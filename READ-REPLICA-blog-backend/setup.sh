echo "🚀 Starting Infra-Crafter Setup..."

echo "📦 Installing npm packages..."
npm install

echo "🛠️ Building the TypeScript project..."
npm run build

echo "🐳 Starting PostgreSQL containers with Docker..."
docker-compose up -d

echo "⏳ Waiting for PostgreSQL to be ready..."
until docker exec master-db pg_isready -U postgres > /dev/null 2>&1; do
  sleep 2
done

echo "🧱 Initializing databases..."
npm run db:init

echo "🧪 Running read-replica CLI test suite..."
npm run db:test

echo "✅ Setup complete! All systems operational."
