declare module '*.mdx' {
  import type { ComponentType } from 'react';

  export const meta: {
    title: string;
    description: string;
    updated_at: string;
  };

  const MDXComponent: ComponentType<{
    components?: Record<string, ComponentType<any>>;
  }>;
  export default MDXComponent;
}
