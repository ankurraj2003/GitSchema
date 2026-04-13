# GitSchema

A modern web application for visualizing and managing Git repository schemas with interactive graph visualization and GitHub integration. https://gitschema.vercel.app

## 🖼 Screenshot
![Architecture Screenshot](https://github.com/ankurraj2003/GitSchema/blob/master/S2.png?raw=true)

## 🎯 Features

- **Interactive Graph Visualization**: Visualize repository structure with XYFlow-based interactive diagrams
- **GitHub Integration**: Direct integration with GitHub API for repository analysis
- **Schema Visualization**: Display complex data structures and relationships using Mermaid diagrams
- **DAG Support**: Utilize Dagre for directed acyclic graph layouts
- **Modern UI**: Built with Radix UI and Shadcn components for a polished user experience
- **TypeScript**: Fully typed codebase for better development experience
- **Responsive Design**: Tailwind CSS for responsive and customizable styling
- **Performance Optimized**: LRU caching for efficient data management

## 📦 Tech Stack

### Core Framework
- **Next.js** (16.1.6) - React frontend
- **FastAPI** - Python backend

### Visualization & Graphs
- **@xyflow/react** (12.10.1) - Interactive flow diagrams
- **@dagrejs/dagre** (2.0.4) - Graph layout engine
- **Mermaid** (11.12.3) - Diagramming and charting library
- **Lucide React** (0.575.0) - Icon library

### API & Analysis (Python)
- **FastAPI** - Modern, high-performance web framework
- **httpx** - Async HTTP client for GitHub API
- **NetworkX** - Complex network analysis for dependencies
- **AI Integration** - Automated code summarization and flow analysis

### UI & Styling
- **Radix UI** (1.4.3) - Accessible component library
- **Tailwind CSS** (4) - Utility-first CSS framework
- **Shadcn/ui** (3.8.5) - High-quality React components

## 📁 File Structure

```
GitSchema/
├── api/                  # Python FastAPI backend (Vercel Functions)
│   ├── index.py          # Main API entry point
│   ├── requirements.txt  # Python dependencies
│   └── ...               # Analysis & logic modules
├── src/
│   ├── app/              # Next.js app directory and pages
│   ├── components/       # Reusable React components
│   └── lib/              # Utility functions and helpers
├── public/               # Static assets
├── vercel.json           # Deployment configuration
├── next.config.ts        # Next.js configuration
└── package.json          # Node.js dependencies and scripts
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/ankurraj2003/GitSchema.git
   cd GitSchema
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. **Set up environment variables** (if needed)
   ```bash
   # Create a .env.local file and add necessary variables
   ```

### Development

Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

The application supports hot module reloading - changes will be reflected automatically as you edit files.

### Building for Production

```bash
npm run build
npm run start
```

### Code Quality

Run linting to check code quality:

```bash
npm run lint
```

## 🏗️ Project Architecture

### Components
- Located in `src/components/`
- Reusable React components built with Radix UI and Shadcn/ui
- Styled with Tailwind CSS

### Application Logic
- Located in `src/app/`
- Next.js pages and layouts
- Server-side and client-side components

### Utilities
- Located in `src/lib/`
- Helper functions
- API integrations
- Data processing utilities

## 🔗 Key Dependencies Explained

- **@xyflow/react**: Creates interactive node-based flow diagrams
- **@dagrejs/dagre**: Provides automatic graph layout algorithms
- **@octokit/rest**: Enables direct GitHub API access for repository data
- **Mermaid**: Renders diagrams from markdown-like syntax
- **Shadcn/ui**: Pre-built, customizable UI components
 - Run ESLint

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the MIT License.
