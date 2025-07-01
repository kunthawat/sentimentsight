# SentimentSight

## Sentiment Analysis Web Application

SentimentSight is a Node.js application designed to provide users with a platform for submitting text snippets and receiving real-time sentiment analysis. It features secure user authentication, a personalized dashboard for tracking historical analysis results, and intuitive data visualizations.

## Overview

SentimentSight leverages a robust Model-View-Controller (MVC) architecture to offer a seamless experience for sentiment analysis. Users can register, log in, submit text for analysis via an external API, and view their past results presented in an organized dashboard with interactive charts. The application ensures secure data storage with MongoDB and a dynamic user interface powered by EJS templating and client-side JavaScript.

## Features

*   **User Authentication**: Secure user registration (`/register`), login (`/login`), and logout (`/logout`) functionalities managed using Passport.js.
*   **Text Submission & Analysis**: Users can submit text snippets for real-time sentiment analysis, which returns classifications such as positive, negative, neutral, or mixed. This is achieved by integrating with a third-party sentiment analysis API service.
*   **Historical Analysis Dashboard**: A personalized dashboard (`/dashboard`) displaying a summary and historical records of all past sentiment analyses performed by the user.
*   **Result Visualization**: Graphical representations (e.g., charts via Chart.js) and tabular views of sentiment analysis results over time, providing clear insights into sentiment trends.
*   **User Profile Management**: Users can view and manage their account details (`/profile`).
*   **Persistent Storage**: All user data and analysis results are securely stored in a MongoDB database.
*   **External API Integration**: Seamless integration with a third-party sentiment analysis service for core analysis capabilities.

## Architecture

SentimentSight follows a Model-View-Controller (MVC) architecture built on Node.js and the Express.js web framework.

*   **Models**: Define the data structure and interact with MongoDB (e.g., `User`, `AnalysisResult`).
*   **Views**: Server-rendered using EJS templating engine, providing the HTML structure (`.ejs` files). Client-side JavaScript (`public/js/`) enhances interactivity.
*   **Controllers**: Handle incoming requests, interact with models and services, and render views (e.g., `authController`, `analysisController`).
*   **Routes**: Define application endpoints and map them to appropriate controller functions.
*   **Services**: Encapsulate logic for interacting with external APIs or complex business operations (e.g., `sentimentApiService`).
*   **Configuration**: Manages application-wide settings, database connections, and authentication strategies (`config/`).
*   **Public Assets**: Static files like CSS and client-side JavaScript (`public/`).

## Installation

To get SentimentSight up and running on your local machine, follow these steps:

### Prerequisites

Before you begin, ensure you have the following installed:

*   **Node.js**: [Download & Install Node.js](https://nodejs.org/en/download/) (LTS version recommended)
*   **npm**: Node Package Manager (comes with Node.js)
*   **MongoDB**: [Download & Install MongoDB Community Server](https://www.mongodb.com/try/download/community) or use a cloud service like MongoDB Atlas.

### Setup Steps

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/your-username/sentimentsight.git
    cd sentimentsight
    ```
    *(Replace `https://github.com/your-username/sentimentsight.git` with the actual repository URL)*

2.  **Install Dependencies:**
    Install all required Node.js packages using npm:
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    Create a `.env` file in the root directory of the project. This file will store sensitive information like your MongoDB connection URI and the API key for the sentiment analysis service.

    ```
    # .env example
    PORT=3000
    MONGODB_URI=mongodb://localhost:27017/sentimentsightdb
    SESSION_SECRET=your_super_secret_session_key
    SENTIMENT_API_KEY=your_external_sentiment_api_key
    ```
    *Replace placeholders with your actual values.*

4.  **Start MongoDB:**
    Ensure your MongoDB server is running. If you're using a local installation, you might need to start the `mongod` process.

5.  **Run the Application:**
    Start the Node.js application:
    ```bash
    npm start
    ```
    or
    ```bash
    node app.js
    ```

    The application should now be running, typically accessible at `http://localhost:3000` (or the `PORT` specified in your `.env` file).

## Usage

1.  **Access the Application**: Open your web browser and navigate to `http://localhost:3000`.

2.  **Register / Login**:
    *   **New Users**: Click on "Register" to create a new account by providing your credentials.
    *   **Existing Users**: Click on "Login" and enter your username/email and password to access your dashboard.

3.  **Dashboard**: Upon successful login, you will be redirected to your personalized dashboard (`/dashboard`). Here, you'll see a summary of your past analyses and quick links to other sections.

4.  **Analyze Text**:
    *   Navigate to the "Analyze Text" section.
    *   Input the text you wish to analyze into the provided form.
    *   Submit the text, and the application will process it through the external sentiment analysis API.
    *   The results (e.g., positive, negative, neutral) will be displayed, and the analysis will be saved to your history.

5.  **View History and Visualizations**: Your dashboard will update with new analysis entries. You can also view detailed historical data and graphical representations of your sentiment analysis results over time.

6.  **Profile Management**: Access the "Profile" section to view and manage your account details.

7.  **Logout**: Click "Logout" from the navigation menu to end your session securely.

## Project Structure and Components

The SentimentSight project is organized into a clear and modular structure to enhance maintainability and scalability.

```
.
??? .env                  # Environment variables for configuration
??? .gitignore            # Specifies intentionally untracked files to ignore
??? app.js                # Main application entry point
??? package.json          # Project metadata and dependencies
??? config/
?   ??? db.js             # Database connection configuration (MongoDB)
?   ??? passport.js       # Passport.js authentication strategies configuration
??? controllers/          # Handles request logic and interacts with models/services
?   ??? analysisController.js
?   ??? authController.js
?   ??? dashboardController.js
?   ??? userController.js
??? models/               # Defines Mongoose schemas and models for MongoDB
?   ??? AnalysisResult.js
?   ??? User.js
??? public/               # Static assets served directly to the browser
?   ??? css/
?   ?   ??? style.css     # Global styling for the application
?   ??? js/
?       ??? chartConfig.js# Configuration for Chart.js visualizations
?       ??? main.js       # Client-side JavaScript for interactivity
??? routes/               # Defines application endpoints and maps to controllers
?   ??? analysisRoutes.js
?   ??? authRoutes.js
?   ??? dashboardRoutes.js
?   ??? profileRoutes.js
??? services/             # Encapsulates business logic for external integrations
?   ??? sentimentApiService.js # Handles communication with external sentiment API
??? utils/                # Utility functions (e.g., validation)
?   ??? validation.js
??? views/                # EJS templates for server-side rendering
    ??? analyze.ejs
    ??? dashboard.ejs
    ??? layout.ejs        # Base layout for all pages
    ??? login.ejs
    ??? profile.ejs
    ??? register.ejs
    ??? partials/         # Reusable EJS partials
        ??? _footer.ejs
        ??? _header.ejs
        ??? _navbar.ejs   # Navigation menu
```

### Key Components Explained:

*   **`app.js`**: The main application file where Express.js is initialized, middleware is configured, routes are loaded, and the server starts listening.
*   **`config/`**: Contains configuration files for the database connection (`db.js`) and Passport.js authentication setup (`passport.js`).
*   **`controllers/`**: These modules contain the core logic for handling specific requests (e.g., user authentication, text analysis, dashboard data retrieval, user profile management). They act as intermediaries between routes and models/services.
*   **`models/`**: Defines the Mongoose schemas for MongoDB, representing the data structures for users and their analysis results.
*   **`public/`**: Stores static assets like global CSS (`style.css`) for consistent styling and client-side JavaScript files (`main.js`, `chartConfig.js`) for interactive elements and data visualization.
*   **`routes/`**: Organizes and defines API endpoints for different features, directing requests to the appropriate controller functions.
*   **`services/sentimentApiService.js`**: A dedicated module for interacting with the external sentiment analysis API, abstracting away the details of the API calls.
*   **`utils/validation.js`**: Provides helper functions for input validation, ensuring data integrity.
*   **`views/`**: Houses all EJS templates. `layout.ejs` provides a consistent base structure, `partials/` contains reusable UI components like navigation (`_navbar.ejs`), header (`_header.ejs`), and footer (`_footer.ejs`). Specific pages like `login.ejs`, `register.ejs`, `dashboard.ejs`, `analyze.ejs`, and `profile.ejs` define the unique content for each section.

### Essential UI/Styling Components:

The following components are crucial for a consistent and user-friendly interface:

*   **`public/css/style.css`**: The central stylesheet responsible for the global look and feel, including typography, color schemes, button styles, form layouts, and responsive design considerations (e.g., media queries).
*   **`views/layout.ejs`**: The primary layout template that wraps all other view content, ensuring common elements like HTML doctype, head section (metadata, stylesheets), and script imports are consistently included.
*   **`views/partials/_navbar.ejs`**: Provides the main navigation menu with links to "Dashboard", "Analyze Text", "Profile", and "Logout," enhancing ease of use.
*   **`views/partials/_header.ejs` & `views/partials/_footer.ejs`**: Reusable components for the page header and footer, ensuring a uniform appearance across the application.
*   **`public/js/chartConfig.js`**: Essential for configuring and rendering dynamic charts (e.g., using Chart.js) on the dashboard to visualize sentiment analysis results effectively.

## Dependencies

The core technologies and npm packages used in SentimentSight include:

*   **Node.js**: The server-side JavaScript runtime.
*   **Express.js**: Fast, unopinionated, minimalist web framework for Node.js.
*   **MongoDB**: NoSQL database for persistent storage.
*   **Mongoose**: MongoDB object modeling for Node.js, providing schema-based solutions.
*   **EJS (Embedded JavaScript templating)**: Templating engine for generating HTML views.
*   **Passport.js**: Authentication middleware for Node.js.
*   **bcrypt.js**: Library for hashing passwords securely.
*   **dotenv**: Module to load environment variables from a `.env` file.
*   **connect-flash**: Middleware to store messages in session and display them to the user.
*   **express-session**: Simple session middleware for Express.
*   **Chart.js**: (Client-side) JavaScript charting library for visualizing data on the dashboard.
*   **External Sentiment Analysis API**: (e.g., Natural Language Toolkit, Google Cloud Natural Language API, or others) - integrated via `services/sentimentApiService.js`.

Specific versions are listed in `package.json`.

## Contributing

We welcome contributions to SentimentSight! If you'd like to contribute, please follow these steps:

1.  Fork the repository.
2.  Create a new branch for your feature or bug fix.
3.  Make your changes and ensure they adhere to the project's coding standards.
4.  Write clear and concise commit messages.
5.  Push your branch and open a pull request.

Please ensure your pull request clearly describes the changes and any relevant issue numbers.

## License

*(This section can be expanded with specific license information, e.g., MIT, Apache 2.0, etc.)*

This project is licensed under the [Your Chosen License] - see the `LICENSE` file for details.