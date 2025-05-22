export interface Component {
  id: string;
  type: string;
  content: any;
  createdAt: string;
  updatedAt: string;
}

export class ComponentService {
  private components: Map<string, Component> = new Map();

  async createComponent(params: { type: string; content: any }): Promise<Component> {
    const id = Date.now().toString();
    const component: Component = {
      id,
      type: params.type,
      content: params.content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.components.set(id, component);
    return component;
  }

  async getComponent(id: string): Promise<Component | null> {
    return this.components.get(id) || null;
  }

  async listComponents(): Promise<Component[]> {
    return Array.from(this.components.values());
  }

  async updateComponent(id: string, content: any): Promise<Component | null> {
    const component = this.components.get(id);
    if (!component) return null;

    const updated: Component = {
      ...component,
      content,
      updatedAt: new Date().toISOString()
    };
    this.components.set(id, updated);
    return updated;
  }

  async deleteComponent(id: string): Promise<boolean> {
    return this.components.delete(id);
  }

  async generatePreview(params: { components: Component[] }): Promise<string> {
    const { components } = params;
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Component Preview</title>
          <style>
            ${this.getDefaultStyles()}
          </style>
        </head>
        <body>
          <div class="container">
            ${components.map(comp => this.renderComponent(comp)).join('\n')}
          </div>
        </body>
      </html>
    `;
  }

  private renderComponent(component: Component): string {
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
            </div>
          </div>
        `;

      default:
        return `<div>Unknown component type: ${component.type}</div>`;
    }
  }

  private getDefaultStyles(): string {
    return `
      :root {
        --primary: #007bff;
        --secondary: #6c757d;
        --text: #212529;
        --background: #ffffff;
      }
      body {
        margin: 0;
        padding: 20px;
        font-family: system-ui, -apple-system, sans-serif;
        background: var(--background);
        color: var(--text);
      }
      .container {
        display: flex;
        flex-direction: column;
        gap: 20px;
        padding: 20px;
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
  }
} 