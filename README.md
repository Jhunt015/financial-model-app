# Financial Model App (EBIT)

A comprehensive M&A financial analysis platform that uses AI and AWS Textract to extract and analyze financial data from business documents.

## Features

- **AWS Textract Integration**: Automatically extracts financial tables and structured data from PDFs
- **AI-Powered Analysis**: Uses OpenAI GPT-4o for intelligent business insights and M&A recommendations
- **Ultra-Intelligence System**: Three-stage analysis providing document intelligence, investment intelligence, and structured mapping
- **5-Year Financial Modeling**: Projects cash flows, IRR, MOIC, and debt service coverage
- **Smart Data Extraction**: Handles various financial statement formats with pattern recognition
- **Interactive UI**: Real-time editing of assumptions, purchase price, and exit values
- **Risk Assessment**: Automated risk scoring and mitigation strategies
- **Value Creation Planning**: Identifies and prioritizes growth opportunities

## Tech Stack

- React 18 with Vite
- Tailwind CSS for styling
- Recharts for data visualization
- AWS SDK for Textract integration
- OpenAI API for AI analysis
- Vercel for deployment
- PDF.js for document processing

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
```

Then edit `.env` and add your API keys:
- `OPENAI_API_KEY` - Required for AI analysis
- `AWS_ACCESS_KEY_ID` - Optional but recommended for AWS Textract
- `AWS_SECRET_ACCESS_KEY` - Optional but recommended for AWS Textract
- `AWS_REGION` - Default: us-east-1

3. Start the development server:
```bash
npm run dev
```

4. Open your browser to `http://localhost:5173`

## API Configuration

The app supports multiple extraction methods:

1. **AWS Textract + AI** (Recommended)
   - Best extraction accuracy for financial tables
   - Requires AWS credentials
   - Falls back to AI-only if not configured

2. **Ultra-Intelligence AI**
   - Three-stage comprehensive analysis
   - Works without AWS credentials
   - Provides detailed investment insights

3. **Hybrid Approach**
   - Combines multiple extraction methods
   - Automatic fallback handling

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