# Exit immediately if a command exits with a non-zero status.
set -e

echo "Installing dependencies..."
npm install

echo "Building the project..."
npm run build

echo "Starting Docker containers (databases)..."
docker-compose up -d

echo "Setting up database tables..."
npm run setup-db

echo "Generating test data..."
npm run generate-data

echo "🚀 Starting API server in the background..."
npm run dev &

sleep 5

echo "Running load tests..."
npm run load-test

echo "Setup complete."
