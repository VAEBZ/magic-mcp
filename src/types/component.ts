export interface Component {
  id: string;
  type: string;
  content: any;
  createdAt: string;
  updatedAt: string;
}

export interface ComponentValidation {
  valid: boolean;
  errors?: string[];
} 