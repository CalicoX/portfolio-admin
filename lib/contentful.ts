import { createClient } from 'contentful';
import { Project, ProjectDetail, SiteProfile, Stat, NavItem, Photo, BlogPost } from '../types';

const client = createClient({
  space: import.meta.env.VITE_CONTENTFUL_SPACE_ID || '',
  accessToken: import.meta.env.VITE_CONTENTFUL_ACCESS_TOKEN || '',
});

export interface ContentfulProject {
  sys: { id: string };
  fields: {
    title: string;
    category: string;
    description?: string;
    content?: any;
    tags?: string | string[];
    year?: string;
    client?: string;
    tools?: string | string[];
    image?: any;
    gallery?: any[];
  };
}

const getImageUrl = (image: any): string => {
  if (!image) return 'https://picsum.photos/800/600';
  if (image.fields?.file?.url) return `https:${image.fields.file.url}`;
  if (image.sys?.type === 'Link') return 'https://picsum.photos/800/600'; // Unresolved link
  return 'https://picsum.photos/800/600';
};

const toStringArray = (value: string | string[] | undefined): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return value.split(',').map(v => v.trim()).filter(Boolean);
};

const toProject = (item: any): Project => ({
  id: item.sys.id,
  title: item.fields.title,
  category: item.fields.category,
  imageUrl: getImageUrl(item.fields.image),
});

const toProjectDetail = (item: any): ProjectDetail => {
  const fields = item.fields;
  return {
    id: item.sys.id,
    title: fields.title,
    category: fields.category,
    description: fields.description || '',
    content: fields.content?.content?.map((node: any) => {
      if (node.nodeType === 'paragraph' && node.content) {
        return node.content.map((textNode: any) => textNode.value || '').join('');
      }
      return '';
    }).join('\n\n') || '',
    tags: toStringArray(fields.tags),
    year: fields.year,
    client: fields.client,
    tools: toStringArray(fields.tools),
    imageUrl: getImageUrl(fields.image),
    gallery: fields.gallery?.map((g: any) => getImageUrl(g)) || [],
  };
};

export const getProjects = async (): Promise<Project[]> => {
  try {
    const response = await client.getEntries({
      content_type: 'portfolio',
      include: 2, // Resolve linked assets
    });
    return response.items.map(toProject);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return [];
  }
};

export const getProjectById = async (id: string): Promise<ProjectDetail | null> => {
  try {
    const response = await client.getEntry(id, { include: 2 });
    return toProjectDetail(response);
  } catch (error) {
    console.error('Error fetching project:', error);
    return null;
  }
};

export const getGraphicDesignProjects = async (): Promise<Project[]> => {
  try {
    const response = await client.getEntries({
      content_type: 'portfolio',
      include: 2,
    });
    return response.items.map(toProject);
  } catch (error) {
    console.error('Error fetching graphic design projects:', error);
    return [];
  }
};

// Site Profile
export const getSiteProfile = async (): Promise<SiteProfile | null> => {
  try {
    const response = await client.getEntries({
      content_type: 'index',
      include: 2,
      limit: 1,
    });
    if (response.items.length === 0) return null;
    const item = response.items[0];
    return {
      id: item.sys.id,
      heroTitle: item.fields.heroTitle || '',
      heroSubtitle: item.fields.heroSubtitle || '',
      name: item.fields.name || '',
      description: item.fields.description || '',
      profileImageUrl: getImageUrl(item.fields.profileImage),
      cvLink: item.fields.cvLink || '',
    };
  } catch (error) {
    console.error('Error fetching site profile:', error);
    return null;
  }
};

// Stats
export const getStats = async (): Promise<Stat[]> => {
  try {
    const response = await client.getEntries({
      content_type: 'stat',
      order: ['fields.order'],
    });
    return response.items.map((item: any) => ({
      id: item.sys.id,
      value: item.fields.value || '',
      label: item.fields.label || '',
      order: item.fields.order || 0,
    }));
  } catch (error) {
    console.error('Error fetching stats:', error);
    return [];
  }
};

// Photos
export const getPhotos = async (): Promise<Photo[]> => {
  try {
    const response = await client.getEntries({
      content_type: 'photo',
      include: 10,
      order: ['-fields.date', '-sys.createdAt'],
    });
    // Build asset lookup map from includes
    const assetMap = new Map<string, any>();
    if (response.includes?.Asset) {
      response.includes.Asset.forEach((asset: any) => {
        assetMap.set(asset.sys.id, asset);
      });
    }
    // Custom image URL resolver that uses the asset map
    const resolveImageUrl = (image: any): string => {
      if (!image) return 'https://picsum.photos/800/600';
      if (image.fields?.file?.url) return `https:${image.fields.file.url}`;
      if (image.sys?.type === 'Link' && image.sys.id) {
        const asset = assetMap.get(image.sys.id);
        if (asset?.fields?.file?.url) {
          return `https:${asset.fields.file.url}`;
        }
      }
      return 'https://picsum.photos/800/600';
    };
    return response.items.map((item: any) => ({
      id: item.sys.id,
      title: item.fields.title || '',
      location: item.fields.location || '',
      imageUrl: resolveImageUrl(item.fields.image),
      aspectRatio: item.fields.aspectRatio || 'aspect-[3/4]',
      date: item.fields.date || '',
    }));
  } catch (error) {
    console.error('Error fetching photos:', error);
    return [];
  }
};

// Navigation
export const getNavigation = async (): Promise<NavItem[]> => {
  try {
    const response = await client.getEntries({
      content_type: 'navigation',
      order: ['fields.order'],
    });
    return response.items.map((item: any) => ({
      id: item.sys.id,
      label: item.fields.label || '',
      path: item.fields.path || '',
      icon: item.fields.icon || 'home',
      order: item.fields.order || 0,
      mobile: item.fields.mobile || undefined, // Short text for mobile navigation
    }));
  } catch (error) {
    console.error('Error fetching navigation:', error);
    // Return default navigation on error
    return [
      { id: '1', label: 'Home', path: '/', icon: 'home', order: 0, mobile: 'Home' },
      { id: '2', label: 'UI Design', path: '/ui-design', icon: 'layout-template', order: 1, mobile: 'UI' },
      { id: '3', label: 'Graphic Design', path: '/graphic-design', icon: 'pen-tool', order: 2, mobile: 'Graphic' },
      { id: '4', label: 'Photos', path: '/photos', icon: 'camera', order: 3, mobile: 'Photos' },
      { id: '5', label: 'Blog', path: '/blog', icon: 'pen-tool', order: 4, mobile: 'Blog' },
    ];
  }
};

// Blog Posts
export const getBlogPosts = async (): Promise<BlogPost[]> => {
  try {
    const response = await client.getEntries({
      content_type: 'blogPost',
      order: ['-fields.publishDate'],
      include: 2,
    });
    return response.items.map((item: any) => ({
      id: item.sys.id,
      title: item.fields.title || '',
      slug: item.fields.slug || '',
      excerpt: item.fields.excerpt || '',
      content: item.fields.content || '',
      coverImage: getImageUrl(item.fields.coverImage),
      author: item.fields.author || 'Alex',
      publishDate: item.fields.publishDate || '',
      readTime: item.fields.readTime || '5 min read',
      tags: item.fields.tags || [],
      category: item.fields.category || 'Design',
    }));
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    return getFakeBlogPosts();
  }
};

export const getBlogPostBySlug = async (slug: string): Promise<BlogPost | null> => {
  try {
    const response = await client.getEntries({
      content_type: 'blogPost',
      'fields.slug': slug,
      include: 2,
      limit: 1,
    });
    if (response.items.length === 0) return null;
    const item = response.items[0];
    return {
      id: item.sys.id,
      title: item.fields.title || '',
      slug: item.fields.slug || '',
      excerpt: item.fields.excerpt || '',
      content: item.fields.content || '',
      coverImage: getImageUrl(item.fields.coverImage),
      author: item.fields.author || 'Alex',
      publishDate: item.fields.publishDate || '',
      readTime: item.fields.readTime || '5 min read',
      tags: item.fields.tags || [],
      category: item.fields.category || 'Design',
    };
  } catch (error) {
    console.error('Error fetching blog post:', error);
    const fakePosts = getFakeBlogPosts();
    return fakePosts.find(p => p.slug === slug) || null;
  }
};

// Fake blog posts for development/testing
const getFakeBlogPosts = (): BlogPost[] => [
  {
    id: '1',
    title: 'The Art of Pixel-Perfect Design: A Modern Approach',
    slug: 'pixel-perfect-design',
    excerpt: 'Exploring the principles of creating pixel-perfect designs in the modern web era, from grid systems to responsive breakpoints.',
    content: `In the world of modern web design, the concept of "pixel-perfect" has evolved significantly. What once meant exact pixel precision has transformed into a more nuanced understanding of design consistency across devices.<br><br>The key principles include establishing a solid grid system, maintaining consistent spacing using 8px or 4px baselines, and ensuring visual hierarchy through careful typographic choices. Tools like Figma have made it easier than ever to maintain these standards while designing for multiple screen sizes.<br><br>When implementing pixel-perfect designs, it's crucial to consider the development phase. Working closely with developers and understanding technical constraints helps create designs that are not only beautiful but also feasible to implement.`,
    coverImage: 'https://picsum.photos/seed/design1/1200/630',
    author: 'Alex',
    publishDate: '2025-01-15',
    readTime: '5 min read',
    tags: ['design', 'ui', 'figma'],
    category: 'Design',
  },
  {
    id: '2',
    title: 'Mastering React Hooks: Best Practices and Patterns',
    slug: 'react-hooks-best-practices',
    excerpt: 'Deep dive into React Hooks, covering common patterns, performance optimization techniques, and how to avoid common pitfalls.',
    content: `React Hooks have revolutionized how we write React components. They provide a more direct API to React features like state and lifecycle methods. But with great power comes great responsibility.<br><br>The most important rule of hooks is to only call them at the top level of your React function. This means no hooks inside loops, conditions, or nested functions. Following this rule ensures that hooks are called in the same order each time a component renders.<br><br>Custom hooks are a powerful way to extract and reuse logic. By creating your own hooks, you can share stateful logic between components without changing their hierarchy. This leads to more maintainable and testable code.<br><br>Performance optimization with hooks requires careful consideration. useMemo and useCallback are powerful tools, but they should be used judiciously. Over-optimization can lead to worse performance and more complex code.`,
    coverImage: 'https://picsum.photos/seed/react1/1200/630',
    author: 'Alex',
    publishDate: '2025-01-12',
    readTime: '8 min read',
    tags: ['react', 'javascript', 'hooks'],
    category: 'Development',
  },
  {
    id: '3',
    title: 'Typography in UI Design: More Than Just Choosing Fonts',
    slug: 'typography-ui-design',
    excerpt: 'Understanding how typography affects user experience, from font pairing to hierarchy and readability.',
    content: `Typography is one of the most critical aspects of UI design, yet it's often overlooked. Good typography does more than just make text readable—it creates hierarchy, establishes brand personality, and guides users through content.<br><br>The foundation of good typography is a solid type scale. Using a modular scale (like 1.25 or 1.5) helps create harmonious relationships between font sizes. Combined with consistent line heights (typically 1.5-1.7 for body text), this creates a rhythm that makes content easy to scan and read.<br><br>Font pairing is an art form. The key is to create contrast while maintaining harmony. A common approach is to pair a display font for headings with a highly readable body font. The contrast creates visual interest while the harmony ensures the design feels cohesive.<br><br>Don't forget about accessibility. Font sizes should be large enough to read comfortably, and there should be sufficient contrast between text and background. WCAG guidelines recommend a contrast ratio of at least 4.5:1 for normal text.`,
    coverImage: 'https://picsum.photos/seed/typo1/1200/630',
    author: 'Alex',
    publishDate: '2025-01-10',
    readTime: '6 min read',
    tags: ['typography', 'design', 'ui'],
    category: 'Design',
  },
  {
    id: '4',
    title: 'Building Accessible Web Applications',
    slug: 'accessible-web-apps',
    excerpt: 'A comprehensive guide to making web applications accessible to everyone, including semantic HTML and ARIA attributes.',
    content: `Accessibility is not an afterthought—it's a fundamental aspect of good web development. Building accessible applications means creating experiences that everyone can use, regardless of their abilities.<br><br>Semantic HTML is the foundation of accessibility. Using proper HTML elements like <nav>, <main>, and <article> provides structure that assistive technologies can understand. Don't use a div when a button will do the job better.<br><br>ARIA attributes fill in the gaps where HTML falls short. They provide additional context to assistive technologies about elements' roles, states, and properties. But remember: first rule of ARIA is don't use ARIA if you don't need to.<br><br>Keyboard accessibility is crucial. Every interactive element should be operable via keyboard. This means visible focus indicators and logical tab order. Test your application with only a keyboard—you'll be surprised at what you discover.<br><br>Color contrast is often overlooked. Ensure text has sufficient contrast against its background (4.5:1 for normal text, 3:1 for large text). Don't rely on color alone to convey information—use text labels or icons as well.`,
    coverImage: 'https://picsum.photos/seed/a11y1/1200/630',
    author: 'Alex',
    publishDate: '2025-01-08',
    readTime: '7 min read',
    tags: ['accessibility', 'a11y', 'frontend'],
    category: 'Development',
  },
  {
    id: '5',
    title: 'The Power of Color Theory in Design Systems',
    slug: 'color-theory-design-systems',
    excerpt: 'How to create consistent and effective color palettes for design systems using color theory principles.',
    content: `Color is one of the most powerful tools in a designer's toolkit. It can evoke emotions, create hierarchy, and establish brand identity. But creating an effective color palette requires understanding color theory.<br><br>The color wheel is your friend. Complementary colors (opposite on the wheel) create vibrant combinations, while analogous colors (adjacent) create harmony. Triadic color schemes offer balance while maintaining vibrancy.<br><br>When building a design system, start with a primary color and build from there. Create variations in different lightness values for hover states and backgrounds. Add a secondary color for accent moments, and a neutral palette for text and backgrounds.<br><br>Don't forget about accessibility. Your color choices must meet contrast ratios for readability. Tools like Stark or the WebAIM contrast checker can help verify your palette meets WCAG standards.<br><br>Limit your palette. Having too many colors creates visual chaos. Most effective design systems use 1-2 primary colors, 1-2 accent colors, and a neutral palette of 5-7 shades.`,
    coverImage: 'https://picsum.photos/seed/color1/1200/630',
    author: 'Alex',
    publishDate: '2025-01-05',
    readTime: '5 min read',
    tags: ['color', 'design-systems', 'design'],
    category: 'Design',
  },
  {
    id: '6',
    title: 'Micro-interactions: The Secret to Delightful UX',
    slug: 'micro-interactions-ux',
    excerpt: 'Exploring how small, thoughtful animations can transform user experience from functional to delightful.',
    content: `Micro-interactions are the subtle animations and feedback that make digital experiences feel alive. They're the heart beat of good UX—the difference between a functional interface and one that feels delightful.<br><br>The four parts of a micro-interaction are: trigger, rules, feedback, and loops/modes. The trigger starts the interaction, rules define what happens, feedback tells users what's happening, and loops determine how it repeats.<br><br>Good micro-interactions are purposeful. Every animation should communicate something—state change, action confirmation, or guidance. Avoid animations that are purely decorative; they can distract and annoy users.<br><br>Timing is everything. Animations should be quick enough to feel responsive but slow enough to be perceived. 200-500ms is the sweet spot for most UI animations. Use easing functions to make movement feel natural.<br><br>Performance matters. Poorly implemented animations can make interfaces feel sluggish. Use CSS transforms and opacity for smooth, performant animations that don't cause layout recalculations.`,
    coverImage: 'https://picsum.photos/seed/ux1/1200/630',
    author: 'Alex',
    publishDate: '2025-01-03',
    readTime: '4 min read',
    tags: ['ux', 'animation', 'micro-interactions'],
    category: 'UX',
  },
  {
    id: '7',
    title: 'TypeScript for React Developers: A Practical Guide',
    slug: 'typescript-react-guide',
    excerpt: 'Practical tips and patterns for using TypeScript effectively in React applications.',
    content: `TypeScript has become the de facto standard for React development. It catches bugs at compile time, provides better IDE support, and makes code more maintainable. But getting the most out of TypeScript requires understanding its features and patterns.<br><br>Start with strict mode enabled. It might feel restrictive at first, but it catches many common errors. Configure your tsconfig.json appropriately, and use ESLint with TypeScript rules for additional safety.<br><br>Typing props correctly is crucial. Use interfaces or type aliases for component props. For complex prop types, consider using utility types like Partial, Pick, or Omit to derive types from existing ones.<br><br>Generic types are powerful but can be overkill. Use them when you have components or functions that work with various types. A good rule of thumb: if you're using 'any', you probably need a generic.<br><br>Type narrowing is a key TypeScript skill. Using type guards, discriminated unions, and the 'in' operator helps TypeScript understand your code better and provides more accurate type checking.`,
    coverImage: 'https://picsum.photos/seed/ts1/1200/630',
    author: 'Alex',
    publishDate: '2025-01-01',
    readTime: '9 min read',
    tags: ['typescript', 'react', 'javascript'],
    category: 'Development',
  },
  {
    id: '8',
    title: 'Designing Dark Mode: Beyond Inverting Colors',
    slug: 'dark-mode-design',
    excerpt: 'Best practices for creating beautiful and usable dark mode interfaces.',
    content: `Dark mode has become a standard feature in modern applications. But good dark mode design is more than just inverting colors—it requires careful consideration of contrast, saturation, and visual hierarchy.<br><br>The biggest mistake is using pure black (#000000) for backgrounds. It creates harsh contrast and can cause eye strain. Instead, use dark grays like #121212 or #1a1a1a. Similarly, avoid pure white for text—off-white (#e0e0e0) is more comfortable for reading.<br><br>Desaturate your colors in dark mode. Vibrant colors that look great on light backgrounds can feel jarring on dark ones. Reduce saturation while maintaining hue to create a more harmonious dark theme.<br><br>Elevation works differently in dark mode. Instead of drop shadows, use lighter shades of the background color to create depth. This maintains the dark aesthetic while providing visual hierarchy.<br><br>Test with real content. Dark mode can change how images and graphics are perceived. Ensure your images work well on dark backgrounds, and consider providing alternatives when necessary.<br><br>Remember user preference. Always provide a toggle and respect system preferences. Some users prefer dark mode for reducing eye strain, while others find light mode more readable.`,
    coverImage: 'https://picsum.photos/seed/dark1/1200/630',
    author: 'Alex',
    publishDate: '2024-12-28',
    readTime: '6 min read',
    tags: ['dark-mode', 'design', 'ui'],
    category: 'Design',
  },
  {
    id: '9',
    title: 'Building Component Libraries: Lessons Learned',
    slug: 'component-libraries-guide',
    excerpt: 'Key insights from building and maintaining design systems and component libraries.',
    content: `Building a component library is a significant investment. Done right, it accelerates development and ensures consistency. Done poorly, it becomes a maintenance burden. Here are lessons learned from building component libraries at scale.<br><br>Start with documentation, not components. Clear documentation sets expectations and guides implementation. Document the what, why, and how of each component. Include examples, best practices, and anti-patterns.<br><br>Design tokens are your foundation. Define your design decisions as tokens—colors, spacing, typography, shadows. This separates design from implementation and makes global changes easier.<br><br>Components should be composable, not monolithic. Build small, focused components that can be combined to create complex UIs. This makes your library more flexible and easier to maintain.<br><br>Version carefully. Breaking changes should be rare and well-communicated. Use semantic versioning and maintain a changelog. Consider supporting multiple major versions for critical components.<br><br>Get buy-in from developers. A component library is a product, and developers are your users. Involve them early, gather feedback, and iterate based on real usage.`,
    coverImage: 'https://picsum.photos/seed/components1/1200/630',
    author: 'Alex',
    publishDate: '2024-12-25',
    readTime: '7 min read',
    tags: ['design-systems', 'components', 'react'],
    category: 'Development',
  },
  {
    id: '10',
    title: 'The Future of UI Design: Trends to Watch in 2025',
    slug: 'ui-design-trends-2025',
    excerpt: 'Exploring emerging trends in UI design and what they mean for designers and developers.',
    content: `The world of UI design is constantly evolving. As we move through 2025, several trends are shaping how we think about and create user interfaces. Understanding these trends helps us create more relevant and engaging experiences.<br><br>3D elements are becoming mainstream. With better browser support and tools like Spline, 3D is no longer reserved for special projects. Subtle 3D elements add depth and interactivity without overwhelming performance.<br><br>AI-powered design is transforming workflows. Tools like Midjourney and Figma's AI features are changing how designers work. The key is using AI to augment, not replace, human creativity.<br><br>Minimalism continues to evolve. We're seeing "super minimalism"—bold typography, generous whitespace, and intentional use of color. It's about removing everything that doesn't serve the user's goal.<br><br>Micro-interactions are getting smarter. Instead of fixed animations, we're seeing context-aware interactions that adapt based on user behavior and preferences.<br><br>Accessibility is no longer optional. With increasing legal requirements and growing awareness, accessible design is becoming standard practice. This is good for everyone—accessible design is better design.<br><br>The biggest trend? Focus on outcomes, not outputs. It's not about having the latest design trend—it's about creating experiences that genuinely help users achieve their goals.`,
    coverImage: 'https://picsum.photos/seed/trends1/1200/630',
    author: 'Alex',
    publishDate: '2024-12-22',
    readTime: '5 min read',
    tags: ['trends', 'design', 'future'],
    category: 'Design',
  },
];
