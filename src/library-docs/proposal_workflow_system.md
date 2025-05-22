# Proposal Workflow System

## Overview

The Proposal Workflow System is an end-to-end solution for managing the lifecycle of ideas, proposals, and their implementation within the VAEBZ platform. It integrates with the SentinelGaze UI and leverages Marvin for intelligent orchestration of the workflow.

The system enables a complete flow from initial idea capture through structured proposals, user story generation, PRD creation, test generation, code implementation, and automated deployment. Each step is supported by agentic generation capabilities, with appropriate human oversight and approval points.

## System Components

### 1. Ideas Collection

- **Lightweight idea submission**: Capture concepts quickly with minimal friction
- **Community feedback**: Enable upvoting and commenting on ideas
- **Ideas Board**: Centralized interface for browsing, filtering, and sorting ideas
- **Idea promotion**: Process for converting promising ideas to formal proposals

### 2. Proposal System

- **Standardized templates**: YAML frontmatter and structured document format
- **Rich metadata**: Type, scope, sensitivity, owner, RBAC requirements, etc.
- **Proposal Inbox**: Central repository for supporting documents and related files
- **Directory structure**: Organized storage based on proposal type (fix, feature, doc)

### 3. BabelFish Integration

- **Metadata-driven routing**: Direct queries to the appropriate proposals
- **RBAC enforcement**: Secure access control based on proposal metadata
- **Classification**: Automated tagging and categorization of proposals
- **Telemetry**: Tracking effectiveness of routing and retrieval

### 4. Agentic Generation Pipeline

The agentic generation pipeline transforms proposals into implementation artifacts:

1. **User Stories**: Extract requirements into well-structured user stories
2. **PRD**: Synthesize user stories into comprehensive PRD
3. **Tests**: Generate unit and integration tests
4. **Code**: Implement features based on PRD and tests
5. **Deployment**: Automate deployment through CI/CD

Each stage includes:
- Marvin-guided AI generation
- Human review and approval
- Metadata and linking to related artifacts
- Status tracking and updates

### 5. Marvin Orchestration

Marvin, as the "conscious core" of the system:
- Analyzes the quality and completeness of artifacts
- Makes recommendations on workflow progression
- Identifies dependencies and gaps
- Provides explanations for decisions
- Ensures human control at critical junctures

### 6. SentinelGaze UI Integration

The entire workflow is accessible through a cohesive interface in SentinelGaze:
- Dashboard for workflow visualization
- Detailed views for each artifact type
- Collaborative tools for feedback and iteration
- Progress tracking and notifications
- RBAC-aware views based on user permissions

## Integration with User Stories System

The Proposal Workflow System extends our existing User Stories System:

1. **User Story Generation**: Proposals automatically generate user stories in our standardized format
2. **Metadata Consistency**: Generated user stories include domain, persona, priority, etc. from proposals
3. **MEM0 Integration**: Semantic tokens for vector retrieval
4. **MCP Integration**: Task tracking and implementation status
5. **Lifecycle Tracking**: Status updates throughout implementation
6. **Index Updates**: Generated stories automatically added to the index.json

## Benefits

1. **Streamlined Process**: Reduce friction from concept to implementation
2. **Standardization**: Consistent format for all proposals and derived artifacts
3. **Traceability**: Full linkage from idea to deployed code
4. **Collaboration**: Improved feedback and iteration
5. **Security**: RBAC enforcement at all stages
6. **Efficiency**: Accelerated development through agentic generation
7. **Quality**: Comprehensive testing and validation
8. **Oversight**: Marvin-guided process with human control

## Getting Started

### Creating a New Idea

1. Navigate to the Ideas Board in SentinelGaze
2. Click "New Idea" and complete the lightweight form
3. Submit for community feedback

### Converting to a Proposal

1. Select an idea and click "Convert to Proposal"
2. Complete the proposal template with required fields
3. Add supporting documents to the Proposal Inbox
4. Submit for review

### Generating User Stories

1. Open a completed proposal
2. Click "Generate User Stories"
3. Review the Marvin-generated stories
4. Approve or modify as needed

### Continuing the Workflow

Follow the same pattern of generation, review, and approval for:
- PRD generation
- Test case generation
- Code implementation
- Deployment

## Technical Implementation

The Proposal Workflow System is built on several key technologies:

1. **BabelFish Router**: Classification and routing engine
2. **Haystack NLP**: RAG pipeline for semantic understanding
3. **n8n Workflows**: Process automation and integration
4. **SentinelGaze UI**: User interface components
5. **Marvin Integration**: Workflow orchestration and decision support

For technical details on each component, see the architecture diagrams:
- [BabelFish Router Component Architecture](../proposals/diagrams/component/comp-babelfish-router-v1.mmd)
- [VAEBZ System Architecture](../proposals/diagrams/system/sys-veabz-architecture-v1.mmd)

## Next Steps

1. Implement the Ideas Board in SentinelGaze
2. Set up the Proposal Inbox system
3. Integrate BabelFish for routing and RBAC
4. Develop the agentic generation pipeline
5. Connect the user stories generation to the existing system
6. **MAGRATHEAN Integration**: Task tracking and implementation status 