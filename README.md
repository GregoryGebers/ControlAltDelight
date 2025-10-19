# CS343 Project 2 Group 17 - Trivia Game
## Project Overview
This project consists of a full-stack trivia web application that allows authenticated users to create or join trivia matches, based on their chosen category. The game consists of the following categories: General Knowledge, Science, Entertainment, Geography, Sports and Politics. 
Players can compete across 4 rounds of randomly selected questions that have been scraped from the internet and view their scores in real time. They can see a leaderboard of all users and their history of matches. 
Admin users have access to a question bank where they can edit and delete questions, as well as a matches page where they can edit the users in a match.


## Members
* Ashton Weir 26978725  
* Gregory Gebers 26947110  
* Katja Wood 27205762  
* Andrew Cottrell 26989395  
* Benjamin Conolly 27251489  

## Project Structure 
```
group-17-rw343-project-2/
├── backend/
│   ├── database/
│   │   └── config/
│   ├── routes/                     # Express routes for API endpoints
│   │   ├── apiRoutes/
│   │   ├── gameRoutes/
│   │   ├── matchRoutes/
│   │   ├── questionRoutes/
│   │   └── userRoutes/
│   ├── game_helpers/               # Handles incoming requests and responses
│   │   └── dbqueries/
│   ├── node_modules/
│   ├── package.json                # Backend dependencies and scripts
│   ├── Dockerfile                  # Backend Docker configuration
│   └── .env                        # Backend environment variables
│
├── frontend/
│   ├── src/
│   │   ├── components/             # Reusable UI components
│   │   ├── pages/                  # Application pages (Leaderboard, Login, Match, etc.)
│   │   ├── hooks/                  # Custom React hooks
│   │   ├── contexts/               # React context providers (Auth, Game state, etc.)
│   │   └── assets/                 # Images, icons, and other static files
│   ├── public/                     # Static public files
│   ├── package.json                # Frontend dependencies and scripts
│   ├── vite.config.js              # Vite configuration
│   ├── Dockerfile                  # Frontend Docker configuration
│   └── .env                        # Frontend environment variables
│
├── database/
│   └── config/                     # Supabase client configuration and setup
│
├── webscraper/
│   └── trivia-collecter/
│
├── docker-compose.yml              # Docker Compose setup for full application
├── .gitignore                      # Files and directories ignored by Git
└── README.md                       # Project documentation
```
## Running the Project
### Frontend (dev mode)
In the terminal, navigate to the frontend directory and run ```docker compose up -d``` 
Then go to ```http://localhost:5173/ ``` in your browser.
When you are done, close the container with ```docker compose down```

### Complete Application
2. From the project root directory, run:
   ```
   docker compose build
   ```
   Or if you want to see the logs:
   ```
   docker compose up
   ```
3. Access the application (for local use):
   - Frontend: http://localhost:5175/
   - Backend API: http://localhost:3000/
4. When done, stop all services:
   ```
   docker compose down
   ```

### AI Usage 

 Chat GPT and DeepSeek were used as debugging tools in the development process of our web application. 
 Tools were used to check spelling and grammar in the final report. 
 They also helped with the structuring the README and Makefile.