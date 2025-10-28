# MondayClone - Task Management App

A React-based task management application inspired by Monday.com, built with Vite, Tailwind CSS, and Lucide React.

## Features

- Create and manage multiple boards
- Add, edit, and delete tasks
- Assign tasks to team members
- Set task status, priority, due dates, and notes
- Search and filter tasks
- Progress tracking
- Supabase integration for data persistence

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm
- Supabase account

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up Supabase:
   - Create a new project at [supabase.com](https://supabase.com)
   - Go to Settings > API to get your project URL and anon key
   - Copy `.env.example` to `.env` and fill in your Supabase credentials:
     ```
     VITE_SUPABASE_URL=your_supabase_project_url
     VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
     ```
   - Run the SQL setup script in `setup.sql` in your Supabase SQL editor

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:5173](http://localhost:5173) in your browser

### Build for Production

```bash
npm run build
```

## Technologies Used

- React 18
- Vite
- Tailwind CSS
- Lucide React (for icons)
- Supabase (for backend and data persistence)
