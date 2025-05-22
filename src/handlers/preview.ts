import { APIGatewayProxyResult } from 'aws-lambda';
import { Component } from './components';

interface PreviewRequest {
  components: Component[];
  layout?: {
    type: 'grid' | 'flex' | 'stack';
    columns?: number;
    gap?: string;
    padding?: string;
  };
  theme?: {
    primary: string;
    secondary: string;
    text: string;
    background: string;
  };
}

function generateHTML(request: PreviewRequest): string {
  const { components, layout = { type: 'stack' }, theme = defaultTheme } = request;

  const styles = `
    :root {
      --primary: ${theme.primary || '#007bff'};
      --secondary: ${theme.secondary || '#6c757d'};
      --text: ${theme.text || '#212529'};
      --background: ${theme.background || '#ffffff'};
    }
    body {
      margin: 0;
      padding: 20px;
      font-family: system-ui, -apple-system, sans-serif;
      background: var(--background);
      color: var(--text);
    }
    .container {
      display: ${layout.type === 'grid' ? 'grid' : 'flex'};
      ${layout.type === 'grid' ? `grid-template-columns: repeat(${layout.columns || 3}, 1fr);` : ''}
      ${layout.type === 'flex' ? 'flex-wrap: wrap;' : ''}
      ${layout.type === 'stack' ? 'flex-direction: column;' : ''}
      gap: ${layout.gap || '20px'};
      padding: ${layout.padding || '20px'};
    }
    .button {
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      background: var(--primary);
      color: white;
      cursor: pointer;
      font-size: 16px;
    }
    .button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .input {
      padding: 8px 12px;
      border: 1px solid var(--secondary);
      border-radius: 4px;
      font-size: 16px;
      width: 100%;
    }
    .card {
      border: 1px solid var(--secondary);
      border-radius: 8px;
      overflow: hidden;
    }
    .card-header {
      padding: 16px;
      background: var(--primary);
      color: white;
    }
    .card-content {
      padding: 16px;
    }
    .card-image {
      width: 100%;
      height: auto;
    }
  `;

  function renderComponent(component: Component): string {
    switch (component.type) {
      case 'button':
        return `
          <button class="button" ${component.content.disabled ? 'disabled' : ''} 
            style="${component.content.style || ''}"
            onclick="console.log('${component.content.action}')"
          >
            ${component.content.label}
          </button>
        `;

      case 'input':
        return `
          <input class="input"
            type="${component.content.type}"
            name="${component.content.name}"
            placeholder="${component.content.placeholder || ''}"
            value="${component.content.value || ''}"
            ${component.content.required ? 'required' : ''}
            ${component.content.disabled ? 'disabled' : ''}
          />
        `;

      case 'card':
        return `
          <div class="card">
            <div class="card-header">
              <h2>${component.content.title}</h2>
              ${component.content.subtitle ? `<p>${component.content.subtitle}</p>` : ''}
            </div>
            ${component.content.image ? `<img class="card-image" src="${component.content.image}" alt="${component.content.title}" />` : ''}
            <div class="card-content">
              ${component.content.content || ''}
              ${component.content.actions ? `
                <div class="card-actions">
                  ${component.content.actions.map((action: any) => `
                    <button class="button" onclick="console.log('${action.action}')">${action.label}</button>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          </div>
        `;

      case 'container':
        return `
          <div style="${component.content.style || ''}" class="container">
            ${component.content.children.map((child: Component) => renderComponent(child)).join('')}
          </div>
        `;

      default:
        return `<div>Unknown component type: ${component.type}</div>`;
    }
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Component Preview</title>
        <style>${styles}</style>
      </head>
      <body>
        <div class="container">
          ${components.map(renderComponent).join('')}
        </div>
      </body>
    </html>
  `;
}

const defaultTheme = {
  primary: '#007bff',
  secondary: '#6c757d',
  text: '#212529',
  background: '#ffffff'
};

export async function generatePreview(request: PreviewRequest): Promise<APIGatewayProxyResult> {
  try {
    const html = generateHTML(request);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
      },
      body: html
    };
  } catch (error) {
    console.error('Error generating preview:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
      },
      body: JSON.stringify({ message: 'Error generating preview' })
    };
  }
} 