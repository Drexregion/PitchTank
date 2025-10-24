# PitchTank

PitchTank is an interactive investment simulation platform that allows users to invest in startup founders using virtual currency. The platform utilizes an Automated Market Maker (AMM) model to determine founder share prices based on supply and demand dynamics.

## Features

- **User Authentication**: Secure signup and login functionality with event-based redirects
- **Event-Based System**: Multiple pitch events with different founders
- **QR Code Sharing**: Share event links via QR codes for instant participant onboarding
- **Investment Simulation**: Invest virtual currency in promising founders
- **Automated Market Maker (AMM)**: Dynamic pricing using constant product formula (x × y = k)
- **Real-time Updates**: Live price changes and portfolio tracking
- **Leaderboards**: Track top founders and investors
- **Interactive Trading Table**: Clean, minimal interface showing owned stock and current prices
- **Tabbed Interface**: Switch between Trading and Leaderboard views
- **Interactive Dashboard**: Monitor your investments and market performance
- **Price History**: View historical price trends with interactive charts
- **Fancy Dark Blue Theme**: Modern, elegant dark theme with animated gradients, glowing effects, and smooth transitions
- **Comprehensive Testing**: Stress tests with 100 concurrent users and 12 edge case scenarios

## Technologies

- **Frontend**: React with TypeScript
- **State Management**: React hooks and context
- **Styling**: TailwindCSS with custom dark blue theme and advanced CSS animations
- **QR Codes**: qrcode.react for event sharing
- **Backend**: Supabase (PostgreSQL, Authentication, Storage)
- **Serverless Functions**: Supabase Edge Functions
- **Realtime Updates**: Supabase Realtime
- **Testing**: TypeScript with ts-node for stress and edge case testing

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

### Running Tests

PitchTank includes comprehensive test suites for the AMM trading system:

```bash
# Run all tests
npm test

# Run stress test (100 concurrent users)
npm run test:stress

# Run edge case tests (12 scenarios)
npm run test:edge
```

See `tests/README.md` for detailed testing documentation.

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

## Testing & Quality Assurance

PitchTank includes enterprise-grade testing:

### Stress Testing

- Simulates 100 concurrent users trading simultaneously
- Verifies constant product formula (x × y = k) is maintained
- Ensures share conservation and no negative values
- Performance metrics and bottleneck identification

### Edge Case Testing

12 comprehensive edge case tests including:

- Price cap enforcement ($100 maximum)
- Minimum reserve protection
- Zero and negative value handling
- Very large trade impact
- Floating-point precision over 100 trades
- Round trip arbitrage prevention
- Depleted pool behavior
- Market cap calculation accuracy
- Extreme K constant values
- Monotonic price increase verification

See `tests/README.md` for complete testing documentation.

## Design System

### Dark Blue Theme

PitchTank features a sophisticated dark theme with professional CSS:

- **Primary Colors**: Deep blues (#0052b3 to #1a80ff)
- **Dark Backgrounds**: Multi-layered gradients with animated orbs
- **Accent Colors**: Cyan (#00d4ff) for highlights and emphasis
- **Grid Pattern Overlay**: Subtle tech-inspired grid backgrounds
- **Animated Gradients**: Pulsing gradient orbs for depth and movement
- **Interactive Elements**: Glow effects on hover and focus states
- **Typography**: High contrast gradient text for excellent readability

### UI Components

- **Event Pages**: Tabbed interface with Trade and Leaderboard views
- **Trading Table**: Clean, minimal table format with inline buy/sell actions
- **QR Share Modal**: Beautiful modal with QR code generation and sharing
- **Liquid Capital Display**: Fixed label showing available trading balance
- **Glassmorphic Cards**: Cards with subtle gradients and border effects
- **Smooth Animations**: Professional transitions throughout the app
- **Responsive Design**: Optimized for all screen sizes
- **Consistent Spacing**: Professional typography and spacing system
- **Accessible Color Contrasts**: WCAG compliant color combinations

## Acknowledgments

- [Supabase](https://supabase.io/)
- [React](https://reactjs.org/)
- [TailwindCSS](https://tailwindcss.com/)
- [Vite](https://vitejs.dev/)
- [TypeScript](https://www.typescriptlang.org/)
