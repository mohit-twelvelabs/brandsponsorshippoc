# 📊 Sponsorship ROI Analysis Platform

A comprehensive video analysis platform that uses AI to detect, analyze, and measure brand sponsorship effectiveness in sports and entertainment content. Built with React, Flask, and powered by TwelveLabs video AI and OpenAI.

## 🚀 Features

### 🔍 **Intelligent Brand Detection**
- Automated logo and brand recognition in video content
- Real-time sponsorship placement analysis
- Multi-brand tracking across video timelines

### 📈 **Advanced Analytics**
- **ROI Measurement**: Calculate sponsorship value and effectiveness
- **Engagement Metrics**: Track viewer attention and sentiment
- **Placement Analysis**: Distinguish between ad placements and in-game integrations
- **Timeline Visualization**: Interactive charts showing brand exposure over time

### 🎯 **Sponsorship Categories**
- **Ad Placements**: CTV commercials, digital overlays, sponsored segments
- **In-Game Placements**: Jersey sponsors, stadium signage, product placements

### 📊 **Rich Reporting**
- Comprehensive brand performance dashboards
- Export capabilities for stakeholder reports
- Competitive intelligence insights
- Strategic recommendations

## 🛠️ Tech Stack

**Frontend:**
- React 18 with TypeScript
- TailwindCSS for styling
- Recharts for data visualization
- Modern responsive design

**Backend:**
- Flask with Python 3.8+
- TwelveLabs Video AI API
- OpenAI GPT integration
- RESTful API architecture

**Deployment:**
- Railway (Backend)
- Netlify (Frontend)
- Environment-based configuration

## ⚡ Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+
- TwelveLabs API Key
- OpenAI API Key

### 1. Clone Repository
```bash
git clone https://github.com/mohit-twelvelabs/brandsponsorshippoc.git
cd brandsponsorshippoc
```

### 2. Environment Setup (optional)

The app no longer requires environment variables at boot — users connect their own TwelveLabs account from inside the app. If you want a "Use default demo account" button to appear on the Connect screen, set the TwelveLabs vars; OpenAI stays server-side.

```bash
cp env.example .env

# Optional — these become the fallback default the Connect screen offers as a one-click button
TWELVELABS_API_KEY=your_twelvelabs_api_key
TWELVELABS_INDEX_ID=your_index_id

# Required for AI insights / executive summary / competitive analysis (server-side only)
OPENAI_API_KEY=your_openai_api_key
```

### 3. Backend Setup
```bash
# Navigate to backend
cd backend

# Install dependencies
pip install -r requirements.txt

# Run Flask server
python app.py
```
Backend runs on `http://localhost:5000`

### 4. Frontend Setup
```bash
# Open new terminal, navigate to frontend
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```
Frontend runs on `http://localhost:3000`

## 🔧 API Configuration

### TwelveLabs Setup
1. Sign up at [TwelveLabs](https://twelvelabs.io)
2. Create a video index
3. Copy your API key and Index ID to `.env`

### OpenAI Setup
1. Get API key from [OpenAI Platform](https://platform.openai.com)
2. Add to `.env` file

## 📖 Usage

### Video Analysis Workflow
1. **Connect**: Paste your TwelveLabs API key, pick an index. The app remembers it per browser. Save multiple accounts and switch between them from the header chip mid-session.
2. **Brand Selection**: Pick brands to analyze. "Paste list" accepts a comma/newline-separated list; "Recently analyzed in this account" replays the last set you used.
3. **Video Selection**: Pick one or multiple videos from the connected index.
4. **Analysis**: Run analysis. Results dashboard renders inline.

### API Endpoints
- `POST /api/upload` - Upload video files
- `GET /api/videos` - List available videos
- `POST /api/analyze/<video_id>` - Analyze video for sponsorships
- `GET /api/analysis/<video_id>` - Get analysis results

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React App     │    │   Flask API     │    │  TwelveLabs     │
│                 │    │                 │    │     AI          │
│ • Dashboard     │◄──►│ • Video Upload  │◄──►│                 │
│ • Analytics     │    │ • Brand Analysis│    │ • Video Index   │
│ • Visualizations│    │ • ROI Metrics   │    │ • AI Analysis   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │    OpenAI       │
                       │                 │
                       │ • GPT Analysis  │
                       │ • Insights      │
                       │ • Recommendations│
                       └─────────────────┘
```

## 🔐 Security

- All API keys stored as environment variables
- No hardcoded credentials in codebase
- CORS configured for secure cross-origin requests
- Input validation on all endpoints

## 🚀 Deployment

### Backend (Railway)
```bash
# Railway CLI deployment
railway login
railway link
railway up
```

### Frontend (Netlify)
```bash
# Build for production
npm run build

# Deploy to Netlify (or connect GitHub repo)
netlify deploy --prod --dir=build
```

## 📊 Sample Analysis Output

```json
{
  "summary": {
    "total_brands_detected": 3,
    "total_brand_appearances": 8,
    "video_duration_minutes": 90.0,
    "analysis_date": "2024-01-15T10:30:00Z"
  },
  "brand_metrics": [
    {
      "brand": "Nike",
      "total_exposure_time": 45.2,
      "total_appearances": 5,
      "roi_score": 8.7,
      "sentiment_score": 0.85,
      "placement_types": ["jersey_sponsor", "stadium_signage"]
    }
  ]
}
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support, email support@yourcompany.com or join our [Discord](https://discord.gg/yourserver).

## 🙏 Acknowledgments

- [TwelveLabs](https://twelvelabs.io) for video AI capabilities
- [OpenAI](https://openai.com) for language model integration
- React and Flask communities for excellent frameworks