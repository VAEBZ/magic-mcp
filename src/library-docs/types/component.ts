export interface Component {
  id: string;
  type: string;
  content: any;
  createdAt: string;
  updatedAt: string;
}

export interface ComponentValidation {
  valid: boolean;
  errors: string[];
}

export interface ComponentTypeDefinition {
  required: string[];
  optional: string[];
}

// Component type definitions
export const componentTypes: Record<string, ComponentTypeDefinition> = {
  container: {
    required: ['children'],
    optional: ['style', 'layout']
  },
  text: {
    required: ['content'],
    optional: ['style', 'format']
  },
  image: {
    required: ['url'],
    optional: ['alt', 'style', 'caption']
  },
  button: {
    required: ['label', 'action'],
    optional: ['style', 'disabled']
  },
  form: {
    required: ['fields'],
    optional: ['submitAction', 'style', 'validation']
  }
};

// Component validation function
export function validateComponent(type: string, content: any): ComponentValidation {
  const errors: string[] = [];
  const typeDefinition = componentTypes[type];

  if (!typeDefinition) {
    return {
      valid: false,
      errors: [`Invalid component type: ${type}`]
    };
  }

  // Check required fields
  for (const field of typeDefinition.required) {
    if (!content.hasOwnProperty(field)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Check for unknown fields
  const allowedFields = [...typeDefinition.required, ...typeDefinition.optional];
  for (const field in content) {
    if (!allowedFields.includes(field)) {
      errors.push(`Unknown field: ${field}`);
    }
  }

  // Type-specific validations
  switch (type) {
    case 'container':
      if (content.layout && !['vertical', 'horizontal', 'grid'].includes(content.layout)) {
        errors.push('Invalid layout value. Must be one of: vertical, horizontal, grid');
      }
      if (content.children && !Array.isArray(content.children)) {
        errors.push('Children must be an array');
      }
      break;

    case 'image':
      if (content.url && typeof content.url !== 'string') {
        errors.push('URL must be a string');
      }
      break;

    case 'button':
      if (content.disabled && typeof content.disabled !== 'boolean') {
        errors.push('Disabled must be a boolean');
      }
      break;

    case 'form':
      if (content.fields && !Array.isArray(content.fields)) {
        errors.push('Fields must be an array');
      }
      break;
  }

  return {
    valid: errors.length === 0,
    errors
  };
} 