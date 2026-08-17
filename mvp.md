# PROJECT SPECIFICATION

## Project Name

**GitHub Repository Intelligence Agent**

---

# Elevator Pitch

An Agentic AI application that understands entire GitHub repositories using RAG (Retrieval-Augmented Generation), ChromaDB, and Gemini.

Users can paste a GitHub repository URL and ask questions about the codebase.

The AI agent will:

* Analyze the repository
* Build a vectorized knowledge base
* Retrieve relevant code
* Explain architecture
* Trace request flows
* Assist developer onboarding
* Answer repository-specific questions

The system should function as an AI Software Architect and Developer Assistant.

---

# Problem Statement

Modern repositories can contain hundreds of files and tens of thousands of lines of code.

New developers struggle to:

* Understand architecture
* Trace request flows
* Locate business logic
* Find where features are implemented
* Understand authentication and database interactions

This project solves that problem through AI-powered repository understanding.

---

# Core Workflow

```text
User Provides GitHub URL
            ↓
Clone Repository
            ↓
Parse Source Code
            ↓
Chunk Files
            ↓
Generate Embeddings
            ↓
Store in ChromaDB
            ↓
Repository Knowledge Base Ready
            ↓
User Asks Question
            ↓
Retrieve Relevant Chunks
            ↓
Gemini Analysis
            ↓
AI Response With Sources
```

---

# Agentic Features

The system is NOT a chatbot.

The system acts as an intelligent software engineering agent.

It must:

1. Understand user intent
2. Search repository knowledge base
3. Retrieve relevant files
4. Combine information from multiple files
5. Build reasoning chains
6. Generate explanations
7. Cite source files

---

# MVP FEATURES

---

## Feature 1: Repository Import

User enters:

```text
https://github.com/owner/repository
```

System:

```text
Clone Repository
Parse Files
Prepare Repository
```

Supported:

```text
Public GitHub Repositories
```

---

## Feature 2: Repository Indexing

Process:

```text
Read Files
↓
Chunk Code
↓
Generate Embeddings
↓
Store In ChromaDB
```

Supported File Types:

```text
.py
.js
.jsx
.ts
.tsx
.html
.css
.md
.json
```

Ignored:

```text
node_modules
dist
build
.git
venv
```

---

## Feature 3: Repository Overview

Generate repository summary.

Display:

```text
Repository Name

Tech Stack

Folder Structure

Languages Used

Important Components

Architecture Summary
```

Example:

```text
Frontend:
React

Backend:
Django

Database:
PostgreSQL

Authentication:
JWT
```

---

## Feature 4: RAG Chat

User can ask:

```text
Explain authentication flow

How are API routes handled?

Where is JWT implemented?

How is database access managed?

Explain payment processing

Trace login request
```

System:

```text
Question
↓
Retriever
↓
Relevant Chunks
↓
Gemini
↓
Answer
```

---

## Feature 5: Source Citations

Every answer must show:

```text
Sources Used

auth.py

middleware.py

jwt_service.py
```

This demonstrates RAG functionality.

---

## Feature 6: Flow Tracing

Example:

User:

```text
Trace Login Flow
```

Response:

```text
urls.py
    ↓
login_view.py
    ↓
auth_service.py
    ↓
jwt_service.py
    ↓
response.py
```

Include code snippets when relevant.

---

## Feature 7: Architecture Explorer

Generate high-level architecture.

Example:

```text
React Frontend
        ↓
Django API
        ↓
Service Layer
        ↓
Database
```

Visualize using Mermaid diagrams.

---

## Feature 8: Developer Onboarding Assistant

User:

```text
I am new to this repository
```

Response:

```text
Recommended Learning Path

1. settings.py

2. urls.py

3. auth.py

4. services/

5. models/
```

---

# USER INTERFACE

---

## Landing Page

Route:

```text
/
```

Purpose:

Repository submission.

Components:

```text
Hero Section

GitHub URL Input

Analyze Repository Button
```

Hero Text:

```text
Understand Any Codebase
Using AI + RAG
```

---

## Repository Dashboard

Route:

```text
/repository/:id
```

Sidebar:

```text
Overview

Chat

Architecture
```

Main Content:

```text
Repository Stats

Languages

Summary

Architecture Snapshot
```

---

## Chat Page

Route:

```text
/repository/:id/chat
```

Layout:

```text
Left Panel
------------
Retrieved Sources

Main Panel
------------
Chat Interface
```

Show:

```text
Question

AI Answer

Source Files

Relevant Code Snippets
```

---

## Architecture Page

Route:

```text
/repository/:id/architecture
```

Display:

```text
Architecture Diagram

Folder Relationships

Component Interactions
```

---

# TECH STACK

## Frontend

```text
React (JSX)

React Router

Tailwind CSS

shadcn/ui

Framer Motion

Axios
```

---

## Backend

```text
Django

Django REST Framework
```

---

## AI

```text
Gemini 2.5 Flash
```

Purpose:

```text
Code Understanding

Architecture Explanation

Flow Analysis

Answer Generation
```

---

## Vector Database

```text
ChromaDB
```

Purpose:

```text
Store Embeddings

Semantic Retrieval
```

---

## Repository Processing

```text
GitPython
```

Purpose:

```text
Clone Repositories

Access Repository Files
```

---

## Database

```text
SQLite
```

Store:

```text
Repositories

Files

Chat History

Metadata
```

---

# DATABASE DESIGN

## Repository

```sql
id
name
github_url
created_at
status
```

---

## RepositoryFile

```sql
id
repository_id
path
content
language
```

---

## CodeChunk

```sql
id
repository_id
file_path
chunk_text
chunk_index
```

---

## ChatSession

```sql
id
repository_id
created_at
```

---

## ChatMessage

```sql
id
chat_session_id
role
content
created_at
```

---

# API ENDPOINTS

## Analyze Repository

```http
POST /api/repositories/analyze
```

Request:

```json
{
  "github_url": "https://github.com/user/repo"
}
```

---

## Get Repository Overview

```http
GET /api/repositories/{id}
```

---

## Get Architecture Summary

```http
GET /api/repositories/{id}/architecture
```

---

## Chat With Repository

```http
POST /api/chat
```

Request:

```json
{
  "repository_id": 1,
  "question": "Explain authentication flow"
}
```

Response:

```json
{
  "answer": "...",
  "sources": [
    "auth.py",
    "middleware.py"
  ]
}
```

---

# BEAUTIFUL UI REQUIREMENTS

Theme:

```text
Dark Mode Default
```

Design Inspiration:

```text
Cursor

Linear

Vercel

Perplexity
```

Requirements:

```text
Modern SaaS Look

Glassmorphism Cards

Smooth Animations

Sidebar Navigation

Beautiful Loading States

Responsive Design
```

---

# LOADING EXPERIENCE

Instead of:

```text
Loading...
```

Show:

```text
Cloning Repository...

Parsing Files...

Generating Embeddings...

Building Knowledge Base...

Repository Ready
```

Animated progress states required.

---

# NOT INCLUDED IN MVP

Do NOT build:

```text
Authentication

Private Repository Support

GitHub OAuth

Multi-Agent Architecture

Pull Request Reviews

Code Generation

Bug Fix Generation

Deployment Analysis

CI/CD Analysis

Team Collaboration

Multi-Repository Search
```

---

# FUTURE ENHANCEMENTS

Version 2:

```text
GitHub OAuth

Private Repositories

Multi-Repository Search
```

Version 3:

```text
Pull Request Analysis

Bug Investigation Agent

Code Refactoring Suggestions
```

Version 4:

```text
Multi-Agent Engineering Assistant
```

---

# RESUME DESCRIPTION

Built a GitHub Repository Intelligence Agent using React, Django, Gemini, ChromaDB, and RAG that semantically indexes source code, retrieves repository context, explains architecture, traces request flows, assists developer onboarding, and answers codebase-specific questions through agentic AI workflows.
