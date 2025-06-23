# ACID-Demo: Relational Database Transactions in Action 🧪

This project is a hands-on TypeScript implementation to demonstrate the **ACID** properties of relational databases using **PostgreSQL**. It's part of the larger [Infra-Crafter](https://github.com/swataswayam-14/Infra-Crafter)
---

## 🧱 What Are ACID Properties?

ACID stands for:
- **Atomicity** — All steps in a transaction succeed or none do.
- **Consistency** — Transactions bring the database from one valid state to another.
- **Isolation** — Concurrent transactions do not interfere with each other.
- **Durability** — Once a transaction commits, it remains, even during system crashes.

---

## Clone & Install Dependencies

git clone https://github.com/swataswayam-14/Infra-Crafter.git
cd Infra-Crafter/ACID-Demo
npm install

## Start the PostgreSQL with Docker

docker-compose up -d

## Run the Demo 

- npm run build
- npm start
