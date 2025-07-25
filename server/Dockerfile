# Use Node.js LTS version
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# Copy package.json and package-lock.json first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Bundle app source
COPY . .

# Your app binds to port 3001 so you'll use the EXPOSE instruction
EXPOSE 3001

# Define environment variable
ENV NODE_ENV=production

# Start the application
CMD ["node", "index.js"]
