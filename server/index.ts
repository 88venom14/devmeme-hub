import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Supabase client (service role for admin actions if needed)
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

app.use(cors());
app.use(express.json());

// GitHub API caching
const githubCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Middleware to verify Supabase Auth token
const authenticate = async (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });

  req.user = user;
  next();
};

// --- API Endpoints ---

// Get GitHub Repo Metadata
app.get('/api/github/repo', async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'URL is required' });

  const repoPath = url.replace('https://github.com/', '');
  
  if (githubCache.has(repoPath)) {
    const cached = githubCache.get(repoPath)!;
    if (Date.now() - cached.timestamp < CACHE_DURATION) {
      return res.json(cached.data);
    }
  }

  try {
    const response = await axios.get(`https://api.github.com/repos/${repoPath}`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        // 'Authorization': `token ${process.env.GITHUB_TOKEN}` // Optional: add if needed
      }
    });

    const repoData = {
      name: response.data.name,
      full_name: response.data.full_name,
      description: response.data.description,
      stargazers_count: response.data.stargazers_count,
      language: response.data.language,
      forks_count: response.data.forks_count,
      license: response.data.license?.name
    };

    githubCache.set(repoPath, { data: repoData, timestamp: Date.now() });
    res.json(repoData);
  } catch (error) {
    console.error('GitHub API error:', error);
    res.status(500).json({ error: 'Failed to fetch GitHub metadata' });
  }
});

// Create Post with GitHub metadata
app.post('/api/posts', authenticate, async (req: any, res) => {
  const { title, description, content_md, image_url, video_url, github_url } = req.body;
  
  let github_repo_json = null;
  if (github_url) {
    // Fetch github data before saving
    try {
      const repoPath = github_url.replace('https://github.com/', '');
      const response = await axios.get(`https://api.github.com/repos/${repoPath}`);
      github_repo_json = response.data;
    } catch (e) {
      console.warn('Could not fetch github repo for post');
    }
  }

  const { data, error } = await supabase
    .from('posts')
    .insert({
      user_id: req.user.id,
      title,
      description,
      content_md,
      image_url,
      video_url,
      github_url,
      github_repo_json
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// Trending Tags
app.get('/api/trending', async (req, res) => {
  // Logic to calculate trending tags/posts
  res.json({
    tags: ['react', 'rust', 'typescript', 'ai', 'supabase'],
    stats: {
      users: 128,
      posts: 1240
    }
  });
});

app.listen(port, () => {
  console.log(`Backend listening at http://localhost:${port}`);
});
