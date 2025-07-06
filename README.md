# Financial Model App (EBIT)

A React application for analyzing SMB acquisitions with financial modeling capabilities.

## Features

- Upload and analyze CIMs and financial statements
- Generate 5-year financial models
- Calculate IRR, MOIC, and debt service coverage ratios
- Interactive assumptions and scenario analysis
- User authentication and model saving

## Tech Stack

- React 18
- Vite
- Tailwind CSS
- Recharts for data visualization
- Lucide React for icons
- XLSX for file processing

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser to `http://localhost:5173`

## Build for Production

```bash
npm run build
```

## Project Structure

```
src/
  App.jsx         # Main application component
  main.jsx        # React entry point
  index.css       # Tailwind CSS imports
index.html        # HTML template
```

## Key Components

- **LandingPage**: Homepage with feature overview
- **FileUpload**: CIM/financial statement upload interface
- **AnalysisSummary**: Initial analysis and risk assessment
- **FinancialModelBuilder**: Interactive 5-year model with adjustable assumptions
- **MyModels**: Saved models dashboard
- **LoginModal**: User authentication
- **EmailCaptureModal**: Model naming and saving

## Data Flow

1. User uploads financial files
2. Files are processed to extract key metrics
3. Initial debt service model is generated
4. User can build detailed 5-year projections
5. Models can be saved and retrieved for future analysis