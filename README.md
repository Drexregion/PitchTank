# PitchTank

PitchTank is an interactive investment simulation platform that allows users to invest in startup founders using virtual currency. The platform utilizes an Automated Market Maker (AMM) model to determine founder share prices based on supply and demand dynamics.

## Features

- **User Authentication**: Secure signup and login functionality
- **Event-Based System**: Multiple pitch events with different founders
- **Investment Simulation**: Invest virtual currency in promising founders
- **Automated Market Maker (AMM)**: Dynamic pricing using constant product formula (x × y = k)
- **Real-time Updates**: Live price changes and portfolio tracking
- **Leaderboards**: Track top founders and investors
- **Interactive Dashboard**: Monitor your investments and market performance
- **Price History**: View historical price trends with interactive charts

## Technologies

- **Frontend**: React with TypeScript
- **State Management**: React hooks and context
- **Styling**: TailwindCSS
- **Backend**: Supabase (PostgreSQL, Authentication, Storage)
- **Serverless Functions**: Supabase Edge Functions
- **Realtime Updates**: Supabase Realtime

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Supabase account

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/PitchTank.git
   cd PitchTank
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn
   ```

3. Create a `.env` file in the root directory with your Supabase credentials:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. Open [http://localhost:5173](http://localhost:5173) to view the app in your browser.

### Database Setup

1. Create the following tables in your Supabase project:
   - `events`: Pitch events
   - `founders`: Startup founders participating in events
   - `investors`: Users with investment capabilities
   - `investor_holdings`: Investment positions
   - `trades`: Record of all buy/sell transactions
   - `price_history`: Historical price data for founders
   - `user_roles`: User permissions and roles

2. Deploy the Edge Function for trade execution:
   ```bash
   supabase functions deploy executeTrade
   ```

## Project Structure

```
src/
├── components/        # UI components
├── hooks/             # Custom React hooks
├── lib/               # Utilities and services
│   ├── supabaseClient.ts     # Supabase client setup
│   └── ammEngine.ts          # AMM calculations
├── pages/             # Page components
├── types/             # TypeScript type definitions
├── main.tsx           # App entry point
└── index.css          # Global styles
```

## Key Concepts

### Automated Market Maker (AMM)

PitchTank uses an AMM model for pricing founder shares. The core formula is `x × y = k`, where:

- `x`: Shares in the pool
- `y`: Cash in the pool
- `k`: Constant product value

This creates a price curve where buying shares increases price and selling decreases it, simulating market dynamics.

### Investor Portfolio

Investors start with an initial balance and can:
- Buy shares in founders
- Sell shares to realize gains/losses
- Track performance via ROI percentage

### Events System

Each PitchTank event represents a pitch competition with:
- Multiple founders
- Independent investor leaderboards
- Separate investment pools

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a pull request

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Acknowledgments

- [Supabase](https://supabase.io/)
- [React](https://reactjs.org/)
- [TailwindCSS](https://tailwindcss.com/)
- [Vite](https://vitejs.dev/)
