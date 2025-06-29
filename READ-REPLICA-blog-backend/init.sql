-- Simple schema for Read Replica Testing

-- USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- POSTS TABLE
CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    author VARCHAR(100) NOT NULL,
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- COMMENTS TABLE
CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- POST_CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS post_categories (
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, category_id)
);

-- INSERT USERS
INSERT INTO users (username, email, full_name) VALUES
  ('john_doe', 'john@example.com', 'John Doe'),
  ('jane_smith', 'jane@example.com', 'Jane Smith'),
  ('bob_wilson', 'bob@example.com', 'Bob Wilson'),
  ('alice_brown', 'alice@example.com', 'Alice Brown'),
  ('charlie_davis', 'charlie@example.com', 'Charlie Davis')
ON CONFLICT (username) DO NOTHING;

-- INSERT CATEGORIES
INSERT INTO categories (name, description) VALUES
  ('Technology', 'Posts about technology and programming'),
  ('Lifestyle', 'Posts about lifestyle and personal experiences'),
  ('Business', 'Posts about business and entrepreneurship'),
  ('Health', 'Posts about health and wellness'),
  ('Education', 'Posts about education and learning')
ON CONFLICT (name) DO NOTHING;

-- INSERT POSTS
INSERT INTO posts (title, content, author, user_id) VALUES
  ('Getting Started with PostgreSQL', 'PostgreSQL is a powerful, open source object-relational database system...', 'john_doe', 1),
  ('Best Practices for Database Design', 'When designing a database, there are several key principles to follow...', 'jane_smith', 2),
  ('Understanding Database Replication', 'Database replication is a process of copying and maintaining database objects...', 'bob_wilson', 3),
  ('Performance Tuning Tips', 'Database performance can be significantly improved by following these tips...', 'alice_brown', 4),
  ('Scaling Your Database', 'As your application grows, your database needs to scale accordingly...', 'charlie_davis', 5)
ON CONFLICT DO NOTHING;

-- INSERT COMMENTS
INSERT INTO comments (post_id, user_id, content) VALUES
  (1, 2, 'Great introduction to PostgreSQL! Very helpful.'),
  (1, 3, 'Thanks for sharing this. I learned a lot.'),
  (2, 1, 'Excellent points on database design.'),
  (3, 4, 'Replication can be tricky, but this explains it well.'),
  (4, 5, 'These performance tips are gold!')
ON CONFLICT DO NOTHING;

-- LINK POSTS TO CATEGORIES
INSERT INTO post_categories (post_id, category_id) VALUES
  (1, 1), (2, 1), (3, 1), (4, 1), (5, 1), (5, 3)
ON CONFLICT DO NOTHING;

-- CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- SETUP TRIGGER FOR updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_posts_updated_at
BEFORE UPDATE ON posts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
