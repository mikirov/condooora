# Condoora Project

Welcome to the Condoora Project! This README provides step-by-step instructions to set up and run the project using `docker-compose`.

## Prerequisites

Before running the project, ensure you have the following installed on your machine:

- **Docker**: [Install Docker](https://docs.docker.com/get-docker/)
- **Docker Compose**: [Install Docker Compose](https://docs.docker.com/compose/install/)

## Environment Variables

The project uses environment variables to configure the services. Create a `.env` file in the root directory of the project with the following variables:

```env
POSTGRES_USER=your_postgres_user
POSTGRES_PASSWORD=your_postgres_password
POSTGRES_DB=your_database_name
NODE_ENV=development
BACKEND_DOCKERFILE=Dockerfile.backend
```
Replace the placeholders with your desired values.

## Services
The project includes the following services:
1.	**Database (db)**: A PostgreSQL database.
2.  **Dashboard Frontend**: Dashboard visualization of the Protocol usage
3.  **Chip Registration Frontend**: Chip registration page
4.	**Backend (backend)**: The main backend service of the project.
5.	**Adminer (adminer)**: A web-based database management tool.

## Running the Project

To start the project, follow these steps:
1.	Build and Start Services:
Run the following command to build and start all services:
```
docker-compose up --build
```
This will start:
- PostgreSQL database
- Backend service
- Adminer (accessible at http://localhost:8080)

2.	Access Adminer:
Open a browser and navigate to http://localhost:8080 to manage the PostgreSQL database. Use the credentials from your .env file.

3.	Stop Services:
To stop all services, press Ctrl+C in the terminal where docker-compose up is running, or run:
```
docker-compose down
```