import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Create MCP server instance
const server = new McpServer({
  name: process.env.MCP_SERVICE_NAME || "magrathean-mcp",
  version: process.env.MCP_SERVICE_VERSION || "1.0.0",
});

// Configuration for library documentation services
const NPM_REGISTRY_URL = "https://registry.npmjs.org";
const GITHUB_API_URL = "https://api.github.com";

interface NpmPackageData {
  name: string;
  description?: string;
  version?: string;
  'dist-tags'?: {
    latest?: string;
  };
  repository?: string | {
    url?: string;
    type?: string;
  };
  keywords?: string[];
  homepage?: string;
}

interface GitHubRepoData {
  full_name?: string;
  description?: string;
  stargazers_count?: number;
  forks_count?: number;
  language?: string;
  size?: number;
  default_branch?: string;
}

interface GitHubReadmeData {
  content?: string;
  encoding?: string;
}

interface GitHubCodeSearchData {
  total_count?: number;
  items?: Array<{
    name: string;
    path: string;
  }>;
}

// Fetch package data from npm registry
async function fetchNpmPackageData(packageName: string): Promise<NpmPackageData> {
  try {
    const response = await fetch(`${NPM_REGISTRY_URL}/${packageName}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch package data: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error fetching NPM package data for ${packageName}:`, error);
    throw error;
  }
}

// Fetch repository data from GitHub
async function fetchGitHubRepoData(repoOwner: string, repoName: string): Promise<GitHubRepoData | null> {
  try {
    const headers: HeadersInit = {};
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
    }
    
    const response = await fetch(`${GITHUB_API_URL}/repos/${repoOwner}/${repoName}`, { headers });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch GitHub data: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error fetching GitHub data for ${repoOwner}/${repoName}:`, error);
    return null;
  }
}

// Fetch README content from GitHub
async function fetchGitHubReadme(repoOwner: string, repoName: string): Promise<string> {
  try {
    const headers: HeadersInit = {};
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
    }
    
    const response = await fetch(`${GITHUB_API_URL}/repos/${repoOwner}/${repoName}/readme`, { 
      headers,
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch README: ${response.statusText}`);
    }
    
    const data: GitHubReadmeData = await response.json();
    
    if (!data.content) {
      return "";
    }
    
    // GitHub returns content as base64 encoded
    return Buffer.from(data.content, 'base64').toString('utf-8');
  } catch (error) {
    console.error(`Error fetching README for ${repoOwner}/${repoName}:`, error);
    return "";
  }
}

// Fetch code snippet count for a repository
async function fetchCodeSnippetCount(repoOwner: string, repoName: string): Promise<number> {
  try {
    const headers: HeadersInit = {};
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
    }

    // Get repository contents
    const fileTypes = ['.js', '.ts', '.py', '.java', '.go', '.rb', '.php', '.cs', '.cpp', '.c'];
    let totalSnippets = 0;
    
    // Use code search API to get a rough estimate of code examples
    for (const fileType of fileTypes) {
      try {
        const searchQuery = encodeURIComponent(`repo:${repoOwner}/${repoName} extension:${fileType.substring(1)} "example" OR "sample" OR "usage" OR "demo"`);
        const response = await fetch(`${GITHUB_API_URL}/search/code?q=${searchQuery}&per_page=1`, { headers });
        
        if (response.ok) {
          const data: GitHubCodeSearchData = await response.json();
          if (data.total_count) {
            totalSnippets += data.total_count;
          }
        }
        
        // Respect GitHub API rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        // Continue with other file types
        console.error(`Error searching ${fileType} files:`, err);
      }
    }
    
    // If we couldn't get code snippet counts, estimate based on repo size
    if (totalSnippets === 0) {
      const repoData = await fetchGitHubRepoData(repoOwner, repoName);
      if (repoData && repoData.size) {
        // Rough estimate: 1 code snippet per 50KB of repo size
        totalSnippets = Math.ceil(repoData.size / 50);
      } else {
        // Default fallback
        totalSnippets = 20;
      }
    }
    
    return totalSnippets;
  } catch (error) {
    console.error(`Error estimating code snippet count for ${repoOwner}/${repoName}:`, error);
    return 10; // Return a reasonable default
  }
}

// Extract GitHub repo info from package data
function extractGitHubInfo(packageData: NpmPackageData): { owner: string, repo: string } | null {
  try {
    if (!packageData.repository) {
      return null;
    }
    
    let repoUrl = "";
    
    if (typeof packageData.repository === 'string') {
      repoUrl = packageData.repository;
    } else if (packageData.repository.url) {
      repoUrl = packageData.repository.url;
    }
    
    // Parse GitHub URL to extract owner and repo
    const githubPattern = /github\.com[\/:]([^\/]+)\/([^\/\.]+)/i;
    const match = repoUrl.match(githubPattern);
    
    if (match && match.length >= 3) {
      return {
        owner: match[1],
        repo: match[2].replace('.git', '')
      };
    }
    
    return null;
  } catch (error) {
    console.error("Error extracting GitHub info:", error);
    return null;
  }
}

// Estimate token count more accurately
function estimateTokenCount(text: string): number {
  if (!text) return 0;
  
  // More accurate token estimation than simple character count
  // Average token is ~4 chars in English + accounting for code which tends to be more dense
  const words = text.split(/\s+/).length;
  const chars = text.length;
  
  // Heuristic: tokens ≈ words + special characters + numbers
  const specialChars = (text.match(/[^\w\s]/g) || []).length;
  const numbers = (text.match(/\d+/g) || []).length;
  
  // Combine factors with empirical weights 
  return Math.ceil(words * 1.1 + specialChars * 0.5 + numbers * 0.5);
}

// Register the resolve-library-id tool
server.tool("resolve-library-id", {
  libraryName: z.string().describe("Library name to search for and retrieve a Context7-compatible library ID")
}, async (params) => {
  const args = params as { libraryName: string };
  console.log(`Resolving library ID for: ${args.libraryName}`);
  
  try {
    // Process all libraries consistently, including Serverless Framework
    const packageName = args.libraryName.toLowerCase().replace(/\s+/g, '-');
    const packageData = await fetchNpmPackageData(packageName);
    const githubInfo = extractGitHubInfo(packageData);
    
    if (githubInfo) {
      const repoData = await fetchGitHubRepoData(githubInfo.owner, githubInfo.repo);
      const codeSnippetCount = await fetchCodeSnippetCount(githubInfo.owner, githubInfo.repo);
      
      return {
        content: [
          {
            type: "text",
            text: `Resolved to ${packageData.name} ${packageData.version || packageData['dist-tags']?.latest || ''}`
          }
        ],
        libraryID: `${githubInfo.owner}/${githubInfo.repo}`,
        name: packageData.name,
        version: packageData.version || packageData['dist-tags']?.latest || '',
        description: packageData.description || repoData?.description || '',
        codeSnippetCount: codeSnippetCount,
        githubStars: repoData?.stargazers_count || 0,
        language: repoData?.language || ''
      };
    }
    
    // No GitHub repository found, return package info without GitHub metadata
    return {
      content: [
        {
          type: "text",
          text: `Resolved to ${packageData.name} ${packageData.version || packageData['dist-tags']?.latest || ''}`
        }
      ],
      libraryID: packageData.name,
      name: packageData.name,
      version: packageData.version || packageData['dist-tags']?.latest || '',
      description: packageData.description || '',
      codeSnippetCount: 0,
      githubStars: 0
    };
    
  } catch (error) {
    console.error("Error resolving library ID:", error);
    
    // Return suggestions for similar libraries based on search
    try {
      const searchResponse = await fetch(`${NPM_REGISTRY_URL}/-/v1/search?text=${encodeURIComponent(args.libraryName)}&size=5`);
      if (searchResponse.ok) {
        const searchData = await searchResponse.json() as { objects: Array<{ package: { name: string } }> };
        const suggestions = searchData.objects.map(item => item.package.name);
        
        return {
          content: [
            {
              type: "text",
              text: `No exact match found for '${args.libraryName}'. Please try one of these suggestions.`
            }
          ],
          suggestions: suggestions.length > 0 ? suggestions : ["serverless", "aws-lambda", "aws-sdk", "express"]
        };
      }
    } catch (err) {
      console.error("Error getting suggestions:", err);
    }
    
    return {
      content: [
        {
          type: "text",
          text: `No exact match found for '${args.libraryName}'. Please try a more specific name.`
        }
      ],
      suggestions: ["serverless", "aws-lambda", "aws-sdk", "express"]
    };
  }
});

// Register the get-library-docs tool
server.tool("get-library-docs", {
  context7CompatibleLibraryID: z.string().describe("Exact Context7-compatible library ID retrieved from 'resolve-library-id'"),
  tokens: z.number().optional().describe("Maximum number of tokens of documentation to retrieve"),
  topic: z.string().optional().describe("Topic to focus documentation on")
}, async (params) => {
  const args = params as { 
    context7CompatibleLibraryID: string;
    tokens?: number;
    topic?: string;
  };
  
  console.log(`Fetching docs for: ${args.context7CompatibleLibraryID}, topic: ${args.topic || 'general'}, tokens: ${args.tokens || 5000}`);
  
  try {
    // Parse the library ID to extract owner and repo (if GitHub format)
    let owner = "";
    let repo = "";
    
    // Check if it's a GitHub-style ID (owner/repo)
    if (args.context7CompatibleLibraryID.includes('/')) {
      [owner, repo] = args.context7CompatibleLibraryID.split('/');
    } else {
      // Try to fetch npm package
      const packageData = await fetchNpmPackageData(args.context7CompatibleLibraryID);
      const githubInfo = extractGitHubInfo(packageData);
      
      if (githubInfo) {
        owner = githubInfo.owner;
        repo = githubInfo.repo;
      }
    }
    
    if (owner && repo) {
      // Fetch README from GitHub
      let documentation = await fetchGitHubReadme(owner, repo);
      
      // If topic specified, try to filter content
      if (args.topic && documentation) {
        const topic = args.topic;
        const topicHeaders = [
          `# ${topic}`,
          `## ${topic}`,
          `### ${topic}`,
          `#### ${topic}`,
          topic.toUpperCase()
        ];
        
        // Simple section extraction - would be better with proper Markdown parsing
        let sectionContent = "";
        for (const header of topicHeaders) {
          const index = documentation.indexOf(header);
          if (index !== -1) {
            // Find the next header of same or higher level
            const startPos = index + header.length;
            let endPos = documentation.length;
            
            const nextHeaderMatch = documentation.slice(startPos).match(/\n(#{1,4} |\*\*\*)/);
            if (nextHeaderMatch && nextHeaderMatch.index !== undefined) {
              endPos = startPos + nextHeaderMatch.index;
            }
            
            sectionContent = documentation.slice(startPos, endPos).trim();
            break;
          }
        }
        
        if (sectionContent) {
          documentation = `${topic}\n\n${sectionContent}`;
        } else {
          // If section not found, try keyword search
          const topicRegex = new RegExp(`\\b${topic}\\b`, 'i');
          if (topicRegex.test(documentation)) {
            // Extract a window of text around instances of the topic
            const lines = documentation.split('\n');
            const relevantLines: string[] = [];
            const contextLines = 5;
            
            lines.forEach((line, index) => {
              if (topicRegex.test(line)) {
                // Add lines before
                for (let i = Math.max(0, index - contextLines); i < index; i++) {
                  relevantLines.push(lines[i]);
                }
                // Add the matching line
                relevantLines.push(line);
                // Add lines after
                for (let i = index + 1; i < Math.min(lines.length, index + contextLines + 1); i++) {
                  relevantLines.push(lines[i]);
                }
              }
            });
            
            if (relevantLines.length > 0) {
              documentation = relevantLines.join('\n');
            }
          }
        }
      }
      
      // Apply token limit if specified
      const maxTokens = args.tokens || 5000;
      const estimatedTokens = estimateTokenCount(documentation);
      
      if (estimatedTokens > maxTokens) {
        // Scale back content proportionally
        const scaleFactor = maxTokens / estimatedTokens;
        const truncateLength = Math.floor(documentation.length * scaleFactor);
        documentation = documentation.substring(0, truncateLength) + "... [Documentation truncated due to token limit]";
      }
      
      return {
        content: [
          {
            type: "text",
            text: documentation
          }
        ],
        libraryName: repo,
        version: "latest",
        topic: args.topic || "general",
        tokenCount: estimateTokenCount(documentation)
      };
    }
    
    // If we reach here, we couldn't find documentation
    // Try fetching from npm registry directly
    try {
      const packageData = await fetchNpmPackageData(args.context7CompatibleLibraryID);
      let documentation = "";
      
      if (packageData.description) {
        documentation += `## Description\n${packageData.description}\n\n`;
      }
      
      if (packageData.homepage) {
        documentation += `## Homepage\n${packageData.homepage}\n\n`;
      }
      
      if (packageData.keywords && packageData.keywords.length > 0) {
        documentation += `## Keywords\n${packageData.keywords.join(', ')}\n\n`;
      }
      
      if (documentation) {
        return {
          content: [
            {
              type: "text",
              text: documentation
            }
          ],
          libraryName: packageData.name,
          version: packageData.version || packageData['dist-tags']?.latest || 'latest',
          topic: args.topic || "general",
          tokenCount: estimateTokenCount(documentation)
        };
      }
    } catch (err) {
      console.error("Error fetching npm fallback documentation:", err);
    }
    
    return {
      content: [
        {
          type: "text",
          text: `No documentation found for library ID: ${args.context7CompatibleLibraryID}`
        }
      ],
      suggestedIds: ["serverless", "aws-lambda", "aws-sdk"],
      isError: true
    };
    
  } catch (error) {
    console.error("Error fetching library docs:", error);
    
    return {
      content: [
        {
          type: "text",
          text: `Error fetching documentation: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      ],
      isError: true
    };
  }
});

// Simple hello tool for testing
server.tool("hello", {
  name: z.string().optional().describe("Your name")
}, async (params) => {
  const args = params as { name?: string };
  return {
    content: [
      {
        type: "text",
        text: `Hello, ${args.name || "world"}!`
      }
    ]
  };
});

// Extend McpServer with a manual tool handler access method
// This is a workaround since the TypeScript SDK doesn't expose a direct method to handle JSON-RPC requests
const originalToolMethod = server.tool.bind(server);
const toolHandlers: Record<string, Function> = {};

// Override the tool method to store tool handlers
// @ts-expect-error - We're monkey-patching the server instance
server.tool = function(name, params, handler) {
  // Store the handler for direct access
  toolHandlers[name] = handler;
  // Call the original method
  return originalToolMethod(name, params, handler);
};

// Add a method to get tool handlers directly
// @ts-expect-error - We're adding a custom method
server.getToolHandler = function(method: string) {
  return toolHandlers[method];
};

// Direct handler for AWS Lambda without middleware
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Request received:', JSON.stringify(event));
  
  try {
    // Parse the body
    const body = event.body ? JSON.parse(event.body) : {};
    
    // Check if this is an MCP request
    if (body && body.method && body.jsonrpc === "2.0") {
      console.log(`Processing MCP request: ${body.method}`);
      
      // Use the MCP server to handle the request
      // In a real implementation, we would use a proper transport
      
      // Process the request with the server
      try {
        // Direct processing of the JSON-RPC request
        // Create our own response since the SDK method may not be available
        const methodFn = toolHandlers[body.method];
        if (!methodFn) {
          return {
            statusCode: 404,
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: body.id,
              error: {
                code: -32601,
                message: `Method not found: ${body.method}`
              }
            }),
          };
        }
        
        // Call the method handler
        const result = await methodFn(body.params || {});
        
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: body.id,
            result: result
          }),
        };
      } catch (err) {
        console.error('Error processing MCP request:', err);
        return {
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: body.id,
            error: {
              code: -32603,
              message: err instanceof Error ? err.message : 'Internal error'
            }
          }),
        };
      }
    }
    
    // Not an MCP request, return info
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'MAGRATHEAN MCP server is running',
        tools: [
          {
            name: 'resolve-library-id',
            description: 'Resolve a library name to a Context7-compatible library ID'
          },
          {
            name: 'get-library-docs',
            description: 'Get library documentation for a Context7-compatible library ID'
          },
          {
            name: 'hello',
            description: 'Simple greeting tool'
          }
        ],
        version: process.env.MCP_SERVICE_VERSION || "1.0.0"
      }),
    };
  } catch (error) {
    console.error('Error processing request:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
}; 