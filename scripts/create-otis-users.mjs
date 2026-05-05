// Script: Create auth users, user profiles, and investor records for OTIS applicants
// Run with: node scripts/create-otis-users.mjs

const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjd3dka3BhZnB4Znh5dXpnbWpzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDY0NzcxNiwiZXhwIjoyMDc2MjIzNzE2fQ.byJSBosnuhpsrIhIh9Fw9yucXc_Y1gQBheH0IBVJCSc";
const BASE = "https://ccwwdkpafpxfxyuzgmjs.supabase.co";
const EVENT_1 = "5a7f6175-17b9-4148-b26c-dbad5e661402";
const EVENT_2 = "42d56d1d-9768-43e1-baaf-a77a9ad573da";

const headers = {
  "Authorization": `Bearer ${SERVICE_KEY}`,
  "apikey": SERVICE_KEY,
  "Content-Type": "application/json",
};

// All new applicants parsed from the OTIS event applications
// existing accounts skipped: rahel.gunaratne@gmail.com, mathew@monvogoventures.com,
//   suzanne@capitalangelinvestors.ca, katie@sheboot.ca, bruce.ford@celestrahealth.com
const applicants = [
  {
    email: "aholmes@sleepefficiency.ca",
    first_name: "Andrew", last_name: "Holmes",
    bio: "Owner, Founder & Corporate Sleep Consultant at Sleep Efficiency Inc. — Canada's leading provider of home-based sleep testing services. Over two decades of experience combining medical-grade testing, personalized care, and engaging education for tech teams.",
    profile_picture_url: "https://ccwwdkpafpxfxyuzgmjs.supabase.co/storage/v1/object/public/application-images/8cbeb8b5-f348-4e7c-b309-9fea5f12bf65/ce82f72a-aad0-4fc8-8ffb-23d424d05c31/1777569991338_Holmes_Headshot_2026.png",
    linkedin_url: null,
  },
  {
    email: "david@aqccapital.ca",
    first_name: "David", last_name: "Dufresne",
    bio: "Partner at AQC Capital. Seasoned tech startup executive and VC investor with 20+ years of experience, including leadership at Bandzoogle and co-founding Panache Ventures. Mentor for Next AI and Creative Destruction Lab. Specializes in pre-seed and seed-stage investments.",
    profile_picture_url: "https://ccwwdkpafpxfxyuzgmjs.supabase.co/storage/v1/object/public/application-images/8cbeb8b5-f348-4e7c-b309-9fea5f12bf65/ce82f72a-aad0-4fc8-8ffb-23d424d05c31/1777570227580_DD.jpeg",
    linkedin_url: null,
  },
  {
    email: "rebecca.wormleighton@zendelity.com",
    first_name: "Rebecca", last_name: "Wormleighton",
    bio: "Co-Founder & COO at Zendelity Corporation. Enterprise marketing leader with 25+ years of experience turning complex technology into clear business value. Leads positioning, market development, customer engagement, and partnerships.",
    profile_picture_url: "https://ccwwdkpafpxfxyuzgmjs.supabase.co/storage/v1/object/public/application-images/8cbeb8b5-f348-4e7c-b309-9fea5f12bf65/9ed833ce-5b3f-49a6-bd9e-505fbf1b0db6/1777587737687_Rebecca%20Wormleighton%203.JPG",
    linkedin_url: "https://www.linkedin.com/in/rebeccawormleighton/",
  },
  {
    email: "michael@actiapartners.com",
    first_name: "Michael", last_name: "Dirk",
    bio: "Technical Partner at Actia Capital Partners — early stage infratech investor focused on tech that makes infrastructure safer, more efficient and more reliable, and next-generation utilities.",
    profile_picture_url: "https://ccwwdkpafpxfxyuzgmjs.supabase.co/storage/v1/object/public/application-images/8cbeb8b5-f348-4e7c-b309-9fea5f12bf65/9ed833ce-5b3f-49a6-bd9e-505fbf1b0db6/1777582254776_MD%20Profile.jpg",
    linkedin_url: "https://www.linkedin.com/in/michael-dirk/",
  },
  {
    email: "audrey@aqccapital.ca",
    first_name: "Audrey", last_name: "Gagniere",
    bio: "Principal at AQC Capital — a generalist VC fund with $165M AUM backing ambitious founders at pre-seed and seed stages across Canada. Portfolio includes Puzzle Medical, Maxa, and Chrysalabs.",
    profile_picture_url: "https://ccwwdkpafpxfxyuzgmjs.supabase.co/storage/v1/object/public/application-images/8cbeb8b5-f348-4e7c-b309-9fea5f12bf65/ce82f72a-aad0-4fc8-8ffb-23d424d05c31/1777575723228_AQCC_Gagniere_Audrey_C%20(1).jpg",
    linkedin_url: null,
  },
  {
    email: "darryl@vuvp.vc",
    first_name: "Darryl", last_name: null,
    bio: "Venture Partner at VU Venture Partners — a global early stage tech venture capital fund focusing on significant market opportunities and solving major challenges for humanity. Invests Pre-Seed to Series A across Consumer, Enterprise, FinTech, Frontier, Healthcare, and PropTech.",
    profile_picture_url: "https://ccwwdkpafpxfxyuzgmjs.supabase.co/storage/v1/object/public/application-images/8cbeb8b5-f348-4e7c-b309-9fea5f12bf65/ce82f72a-aad0-4fc8-8ffb-23d424d05c31/1777576247371_darryl%20headshot%20-%20clear%20back.png",
    linkedin_url: null,
  },
  {
    email: "simon@vision-connected.com",
    first_name: "Simon", last_name: "Morris",
    bio: "Serial tech entrepreneur with 25+ years leading 3 venture-backed deep tech start-ups to exits. Executive Advisor at Connected Vision Advisors. Mentor at Creative Destruction Lab. Former TI engineer. LP at Mistral Venture Partners. M.Eng, Royal Military College of Canada.",
    profile_picture_url: "https://ccwwdkpafpxfxyuzgmjs.supabase.co/storage/v1/object/public/application-images/8cbeb8b5-f348-4e7c-b309-9fea5f12bf65/9ed833ce-5b3f-49a6-bd9e-505fbf1b0db6/1777582566254_S%20Morris%20head%20shot.jpg",
    linkedin_url: "https://www.linkedin.com/in/simon-morris123/",
  },
  {
    email: "bryan.martin@tissuetinker.com",
    first_name: "Bryan", last_name: "Martin",
    bio: "Tech entrepreneur with 10+ years building companies. Currently working in engineered human tissue models, next generation contact lens materials and maternal health at Tissue Tinker Bio.",
    profile_picture_url: "https://ccwwdkpafpxfxyuzgmjs.supabase.co/storage/v1/object/public/application-images/8cbeb8b5-f348-4e7c-b309-9fea5f12bf65/5a87709a-e7aa-414b-b40d-989a8982220e/1777579886007_Bryan%20Martin%202019.png",
    linkedin_url: null,
  },
  {
    email: "admin@ark-ev.com",
    first_name: "Peter", last_name: "Garland",
    bio: "Founder & Creative Director at ARK EV Inc. Ontario-based solo founder with 5 years R&D in design and manufacture of self-driving EVs. Focus on the robotaxi market with key technologies including hub motors, sodium/solid state batteries, and an extensive patent portfolio.",
    profile_picture_url: "https://ccwwdkpafpxfxyuzgmjs.supabase.co/storage/v1/object/public/application-images/8cbeb8b5-f348-4e7c-b309-9fea5f12bf65/9ed833ce-5b3f-49a6-bd9e-505fbf1b0db6/1777583138420_BIZ.avatar.2020.jpg",
    linkedin_url: "https://www.linkedin.com/in/peter-garland-94527351/",
  },
  {
    email: "jeff.chery@gbriefai.com",
    first_name: "Jeff", last_name: "Chery",
    bio: "Founder & CEO of GBrief AI — building the intelligence layer for government approvals, compliance, and executive decision-making. 10+ years leading digital transformation and national security programs across the Government of Canada. University of Ottawa graduate in Economics.",
    profile_picture_url: "https://ccwwdkpafpxfxyuzgmjs.supabase.co/storage/v1/object/public/application-images/8cbeb8b5-f348-4e7c-b309-9fea5f12bf65/9ed833ce-5b3f-49a6-bd9e-505fbf1b0db6/1777581448471_IMG_8428.jpeg",
    linkedin_url: "https://linkedin.com/in/jephthe-chery-38286a9a",
  },
  {
    email: "nolan@aventurecapital.vc",
    first_name: "Nolan", last_name: "Beanlands",
    bio: "Managing Director at Aventure Capital and Assistant Director of the Entrepreneurship Hub at the University of Ottawa. Dedicated champion of the Ottawa startup ecosystem, helping founders access capital and mentorship.",
    profile_picture_url: null,
    linkedin_url: "https://www.linkedin.com/in/nolanbeanlands",
  },
  {
    email: "robert.ritlop@cm-equity.ca",
    first_name: "Robert", last_name: "Ritlop",
    bio: "Investor at Credit Mutuel Equity, focused on VC and growth equity investments.",
    profile_picture_url: null,
    linkedin_url: null,
  },
  {
    email: "mgiro027@uottawa.ca",
    first_name: "Mathieu", last_name: "Giroux",
    bio: "CEO of Precision IR Inc. Completed PhD in 2025 at the University of Ottawa with expertise in photonics and nanotechnology. Leads development of high-performance infrared detectors for cutting-edge research applications.",
    profile_picture_url: "https://ccwwdkpafpxfxyuzgmjs.supabase.co/storage/v1/object/public/application-images/8cbeb8b5-f348-4e7c-b309-9fea5f12bf65/9ed833ce-5b3f-49a6-bd9e-505fbf1b0db6/1777582880225_Headshot_Mathieu.jpg",
    linkedin_url: "https://www.linkedin.com/in/mathieu-giroux-3068782a0/",
  },
  {
    email: "todorov@fulbrightmail.org",
    first_name: "Rad", last_name: "Todorov",
    bio: "Faculty Member in Finance at John Molson School of Business.",
    profile_picture_url: "https://ccwwdkpafpxfxyuzgmjs.supabase.co/storage/v1/object/public/application-images/8cbeb8b5-f348-4e7c-b309-9fea5f12bf65/9ed833ce-5b3f-49a6-bd9e-505fbf1b0db6/1777583877244_Radomir%20Todorov%20Photo.png",
    linkedin_url: null,
  },
  {
    email: "sabina@nimblesci.com",
    first_name: "Sabina", last_name: "Bruehlmann",
    bio: "CEO of Nimble Science — health technology company with a proprietary platform for small intestinal diagnostics. Co-founded Zephyr Sleep Technologies. PhD in Biomedical Engineering, University of Calgary. 20+ years in medical technology commercialization.",
    profile_picture_url: "https://ccwwdkpafpxfxyuzgmjs.supabase.co/storage/v1/object/public/application-images/8cbeb8b5-f348-4e7c-b309-9fea5f12bf65/9ed833ce-5b3f-49a6-bd9e-505fbf1b0db6/1777586190718_Sabina.jpg",
    linkedin_url: "https://www.linkedin.com/in/sabinabruehlmann",
  },
  {
    email: "jorge@jplug.io",
    first_name: "Jorge", last_name: "Pantoja",
    bio: null,
    profile_picture_url: "https://ccwwdkpafpxfxyuzgmjs.supabase.co/storage/v1/object/public/application-images/8cbeb8b5-f348-4e7c-b309-9fea5f12bf65/9ed833ce-5b3f-49a6-bd9e-505fbf1b0db6/1777589838618_IMG_5247.dng",
    linkedin_url: "https://www.linkedin.com/in/jorge-antonio-pantoja",
  },
  {
    email: "adam.stratton@nodiac.ai",
    first_name: "Adam", last_name: "Stratton",
    bio: "Strategic business leader expert in renewable energy development and clean technologies. Fortune 500 international experience across 40+ countries. Background in product development, fundraising, and go-to-market strategy. Fluent in French and Spanish.",
    profile_picture_url: "https://ccwwdkpafpxfxyuzgmjs.supabase.co/storage/v1/object/public/application-images/8cbeb8b5-f348-4e7c-b309-9fea5f12bf65/9ed833ce-5b3f-49a6-bd9e-505fbf1b0db6/1777603671460_bbe9fc6e-4f54-40b5-bb91-14d8612c6e39.jpg",
    linkedin_url: "https://www.linkedin.com/in/adam-william-stratton-91683714/",
  },
  {
    email: "susan@aftermatters.ca",
    first_name: "Susan", last_name: "Campbell",
    bio: "Founder of AfterMatters — Canada's first AI-driven, province-aware platform for life, emergency, and estate planning. 23+ years of cross-sector leadership across healthcare, hospitality, technology, and strategic partnerships. Invest Ottawa Ignition Program graduate.",
    profile_picture_url: "https://ccwwdkpafpxfxyuzgmjs.supabase.co/storage/v1/object/public/application-images/8cbeb8b5-f348-4e7c-b309-9fea5f12bf65/9ed833ce-5b3f-49a6-bd9e-505fbf1b0db6/1777613606396_93DA6171-C1D3-4E88-A8B3-54DCD8E7391A.JPG",
    linkedin_url: "https://www.linkedin.com/in/suelynnecampbell",
  },
  {
    email: "kostya@gbatteries.com",
    first_name: "Kostyantyn", last_name: "Khomutov",
    bio: "Co-founder and CEO of GBatteries — building dual-use smart chargers and battery intelligence for drones and electric aviation. Carleton-trained aerospace engineer. Scaled to revenue with 60+ patents and selected into NATO DIANA 2026.",
    profile_picture_url: "https://ccwwdkpafpxfxyuzgmjs.supabase.co/storage/v1/object/public/application-images/8cbeb8b5-f348-4e7c-b309-9fea5f12bf65/9ed833ce-5b3f-49a6-bd9e-505fbf1b0db6/1777646127771_IMG_8417.jpg",
    linkedin_url: "https://www.linkedin.com/in/kostyantynkhomutov/",
  },
  {
    email: "bruno@crypto4a.com",
    first_name: "Bruno", last_name: "Couillard",
    bio: "Co-Founder and CEO of Crypto4A Technologies — developing quantum-safe cryptographic infrastructure for critical systems. Advocate for sovereign cybersecurity capability and practical pathways toward quantum-resilient security architectures.",
    profile_picture_url: "https://ccwwdkpafpxfxyuzgmjs.supabase.co/storage/v1/object/public/application-images/8cbeb8b5-f348-4e7c-b309-9fea5f12bf65/9ed833ce-5b3f-49a6-bd9e-505fbf1b0db6/1777625640791_Bruno%209.jpg",
    linkedin_url: "https://www.linkedin.com/in/brunocouillard/",
  },
  {
    email: "bwatson@cleantechnorth.org",
    first_name: "Bryan", last_name: "Watson",
    bio: "Managing Director of CleanTech North since 2012. Founding Director of the Ontario Clean Technology Industry Association. 2021 Clean50 Award recipient. Former SVP at Easly, Partner at Flow Ventures, and Executive Director of NACO Canada. Master's from University of St. Andrews.",
    profile_picture_url: "https://ccwwdkpafpxfxyuzgmjs.supabase.co/storage/v1/object/public/application-images/8cbeb8b5-f348-4e7c-b309-9fea5f12bf65/9ed833ce-5b3f-49a6-bd9e-505fbf1b0db6/1777634824455_CTN_S_Headshot.png",
    linkedin_url: "https://www.linkedin.com/in/cleantechnorth/",
  },
  {
    email: "theresa@thegain.ca",
    first_name: "Theresa", last_name: "Evanoff",
    bio: "Executive Director of Global Angel Investor Network (GAIN) — Canada's first global-facing angel investment network. 20+ years of leadership in strategy and innovation across Asia, Europe, and Canada. Launched accelerators for German Accelerator Southeast Asia and Moody's for Startups.",
    profile_picture_url: "https://ccwwdkpafpxfxyuzgmjs.supabase.co/storage/v1/object/public/application-images/8cbeb8b5-f348-4e7c-b309-9fea5f12bf65/9ed833ce-5b3f-49a6-bd9e-505fbf1b0db6/1777634965696_Theresa%20Evanoff%20Headshot%20(2026).jpeg",
    linkedin_url: "https://www.linkedin.com/in/theresakevanoff/",
  },
  {
    email: "ahudon@marsdd.com",
    first_name: "Andrew", last_name: "Hudon",
    bio: "Senior Associate at MaRS IAF investing in early stage technology companies. Focuses on teams building defensible IP and products that can scale. Background spans engineering and commercial roles to assess technical risk alongside go-to-market execution.",
    profile_picture_url: "https://ccwwdkpafpxfxyuzgmjs.supabase.co/storage/v1/object/public/application-images/8cbeb8b5-f348-4e7c-b309-9fea5f12bf65/9ed833ce-5b3f-49a6-bd9e-505fbf1b0db6/1777638767247_1737048998940.jpeg",
    linkedin_url: "https://www.linkedin.com/in/andrewhudon/",
  },
  {
    email: "jennifer@capitalangels.ca",
    first_name: "Jennifer", last_name: "Francis",
    bio: "Chair of Capital Angel Network and co-founder of SheBoot.",
    profile_picture_url: "https://ccwwdkpafpxfxyuzgmjs.supabase.co/storage/v1/object/public/application-images/8cbeb8b5-f348-4e7c-b309-9fea5f12bf65/9ed833ce-5b3f-49a6-bd9e-505fbf1b0db6/1777639853897_Jennifer%20Francis%20Headshot%202.jpg",
    linkedin_url: "https://www.linkedin.com/in/jennifer-francis261/",
  },
  {
    email: "kevin@graphitevc.com",
    first_name: "Kevin", last_name: "Madill",
    bio: "Partner at Graphite Ventures — one of Canada's largest and most active Seed-stage VC firms. 20+ years as co-founder, entrepreneur, operator, and advisor. Co-founder and former CPO of Miovision. BSc, University of Waterloo in Systems Design Engineering.",
    profile_picture_url: "https://ccwwdkpafpxfxyuzgmjs.supabase.co/storage/v1/object/public/application-images/8cbeb8b5-f348-4e7c-b309-9fea5f12bf65/9ed833ce-5b3f-49a6-bd9e-505fbf1b0db6/1777648441954_1763051628757.jpeg",
    linkedin_url: "https://www.linkedin.com/in/kmadill/",
  },
  {
    email: "rferguson@smtplus.com",
    first_name: "RJ", last_name: "Ferguson",
    bio: "Co-founder and business leader with 40+ years of experience in workforce training, performance improvement, and competency development. Driving force behind SMT Plus Canada Ltd. Also co-founder of a stealth consumer electronics platform spanning gaming, mental wellness, and digital advertising.",
    profile_picture_url: "https://ccwwdkpafpxfxyuzgmjs.supabase.co/storage/v1/object/public/application-images/8cbeb8b5-f348-4e7c-b309-9fea5f12bf65/9ed833ce-5b3f-49a6-bd9e-505fbf1b0db6/1777651666779_RJ2024.jpg",
    linkedin_url: "https://www.linkedin.com/in/rjferguson/",
  },
  {
    email: "donna.heslin@mississauga.ca",
    first_name: "Donna", last_name: "Heslin",
    bio: null,
    profile_picture_url: "https://ccwwdkpafpxfxyuzgmjs.supabase.co/storage/v1/object/public/application-images/8cbeb8b5-f348-4e7c-b309-9fea5f12bf65/9ed833ce-5b3f-49a6-bd9e-505fbf1b0db6/1777653079914_DH%20Headshot%2024b.jpg",
    linkedin_url: "https://www.linkedin.com/in/donnaheslin/",
  },
  {
    email: "tianna.feng@landtoinnovate.org",
    first_name: "Tianna", last_name: "Feng",
    bio: "CEO of Arrivion and Executive Director of Land to Innovate. Strategist and ecosystem architect building the Youth AI Summit (YAS) for students ages 12-22. Speaker on Women Leading Innovation, AI Readiness, and HealthTech Entrepreneurship.",
    profile_picture_url: "https://ccwwdkpafpxfxyuzgmjs.supabase.co/storage/v1/object/public/application-images/8cbeb8b5-f348-4e7c-b309-9fea5f12bf65/9ed833ce-5b3f-49a6-bd9e-505fbf1b0db6/1777653216316_tianna.jpg",
    linkedin_url: "https://www.linkedin.com/in/tiangang-feng-6299b330/",
  },
  {
    email: "rphilipp2@uottawa.ca",
    first_name: "Ryan", last_name: "Philippe",
    bio: "Senior Director at the Ottawa Health and Life Sciences Innovation Hub. Bridges public policy, emerging technology, and investment ecosystems to accelerate the development and adoption of high-impact health innovations.",
    profile_picture_url: "https://ccwwdkpafpxfxyuzgmjs.supabase.co/storage/v1/object/public/application-images/8cbeb8b5-f348-4e7c-b309-9fea5f12bf65/9ed833ce-5b3f-49a6-bd9e-505fbf1b0db6/1777660182994_Ryan%20Philippe-high%20res.jpg",
    linkedin_url: "https://www.linkedin.com/in/ryanphilippe/",
  },
  {
    email: "raphael.stgelais@outlook.com",
    first_name: "Raphael", last_name: "St-Gelais",
    bio: "Associate Professor at uOttawa and co-founder of Precision IR Inc. Commercializing best-in-class infrared light detectors for demanding applications in Photonics, Spectroscopy and Life Science. Fabrication entirely made in Ottawa.",
    profile_picture_url: "https://ccwwdkpafpxfxyuzgmjs.supabase.co/storage/v1/object/public/application-images/8cbeb8b5-f348-4e7c-b309-9fea5f12bf65/9ed833ce-5b3f-49a6-bd9e-505fbf1b0db6/1777666441516_mugshot%20RSTG.jpg",
    linkedin_url: "https://www.linkedin.com/in/raphael-st-gelais/",
  },
  {
    email: "gharsa.amin@kavodax.com",
    first_name: "Gharsa", last_name: "Amin",
    bio: "Founder & CEO of Kavodax — Canada's first stablecoin-powered cross-border payments platform, live across 50 countries. Named one of Spark Centre's Top 10 Women to Watch in 2026. Master's in Public Administration with a focus on financial crime management.",
    profile_picture_url: null,
    linkedin_url: "https://www.linkedin.com/in/gharsanay-amin/",
  },
  {
    email: "thealzel@archangelnetwork.ca",
    first_name: "Thealzel", last_name: "Lee",
    bio: "Co-Founder and General Partner of Phoenix Fire Fund (Archangel Fund investing in Canadian women entrepreneurs) and VANTEC eFund. Former manager of VANTEC Angel Network and Vancouver Keiretsu Forum. Board director and 30+ years in the startup ecosystem.",
    profile_picture_url: "https://ccwwdkpafpxfxyuzgmjs.supabase.co/storage/v1/object/public/application-images/8cbeb8b5-f348-4e7c-b309-9fea5f12bf65/9ed833ce-5b3f-49a6-bd9e-505fbf1b0db6/1777849909789_2022_11_28%20-%20Archangel%20202220221122190.jpg",
    linkedin_url: "https://www.linkedin.com/in/thealzel",
  },
  {
    email: "adnaali@deloitte.ca",
    first_name: "Adnan", last_name: "Ali",
    bio: "Senior Manager at Deloitte advising high-growth technology companies on dilutive and non-dilutive funding strategies. Technology background with deep experience in innovation funding and ongoing PhD research in Behavioral Finance.",
    profile_picture_url: "https://ccwwdkpafpxfxyuzgmjs.supabase.co/storage/v1/object/public/application-images/8cbeb8b5-f348-4e7c-b309-9fea5f12bf65/9ed833ce-5b3f-49a6-bd9e-505fbf1b0db6/1777867040635_Downsampled.jpg",
    linkedin_url: "https://www.linkedin.com/in/adnanali-peng/",
  },
  {
    email: "diane@archangelnetwork.ca",
    first_name: "Diane", last_name: "Wolfenden",
    bio: "Active angel investor and General Partner in Phoenix Fire: an Archangel Network Fund investing in women entrepreneurs. Charter member of Golden Triangle Angel Network (GTAN) since 2009. Formerly an investment advisor with RBC Dominion Securities.",
    profile_picture_url: "https://ccwwdkpafpxfxyuzgmjs.supabase.co/storage/v1/object/public/application-images/8cbeb8b5-f348-4e7c-b309-9fea5f12bf65/9ed833ce-5b3f-49a6-bd9e-505fbf1b0db6/1777900489819_Wolfenden_Head_Shot_Colour_(2022_11_28).jpg",
    linkedin_url: "https://www.linkedin.com/in/dianewolfenden/",
  },
  {
    email: "angella@rntr.world",
    first_name: "Angella", last_name: "Goran",
    bio: "Former professional cyclist, entrepreneur and philanthropist. Founder of TAPanGO, RNTR Global Holdings, and Power Play Impact Fund (501c3). Organizing an inaugural Guinness World Record Event, The Power Hour, in October 2026.",
    profile_picture_url: "https://ccwwdkpafpxfxyuzgmjs.supabase.co/storage/v1/object/public/application-images/8cbeb8b5-f348-4e7c-b309-9fea5f12bf65/9ed833ce-5b3f-49a6-bd9e-505fbf1b0db6/1777900525176_AngellaProfessionBioHeadshot.jpeg",
    linkedin_url: "https://www.linkedin.com/in/angella-g-b382369",
  },
  {
    email: "gabriel@h2analytics.ca",
    first_name: "Gabriel", last_name: "Sirois",
    bio: "CFO of H2 Analytics — Ottawa-based mid-market defence technology company specializing in AI-enabled training and simulation software. Named in Deloitte's 2025 Technology Fast 50 Companies-to-Watch category.",
    profile_picture_url: null,
    linkedin_url: "https://www.linkedin.com/in/gabriel-sirois-cfa-a9786b45/",
  },
  {
    email: "elacasse49@gmail.com",
    first_name: "Eric", last_name: "LaCasse",
    bio: "Associate Scientist at CHEO Research Institute and CSO of Protaxis Therapeutics. PhD in Biochemistry, uOttawa. Cancer biology researcher and innovator; developed the first IAP-targeting drug to enter clinical trials and show clinical activity.",
    profile_picture_url: "https://ccwwdkpafpxfxyuzgmjs.supabase.co/storage/v1/object/public/application-images/8cbeb8b5-f348-4e7c-b309-9fea5f12bf65/9ed833ce-5b3f-49a6-bd9e-505fbf1b0db6/1777922032036_Lacasse-Eric_RI-290x290.jpg",
    linkedin_url: null,
  },
  {
    email: "jpcadorette@waltercm.ca",
    first_name: "Jean-Pierre", last_name: "Cadorette",
    bio: "EVP at Walter Capital Management. CFA with 20+ years in financial markets. Portfolio Manager and Chief Compliance Officer for Walter Public Investments. Former VP at RBC Global Asset Management and Scotia Institutional Asset Management.",
    profile_picture_url: "https://ccwwdkpafpxfxyuzgmjs.supabase.co/storage/v1/object/public/application-images/8cbeb8b5-f348-4e7c-b309-9fea5f12bf65/9ed833ce-5b3f-49a6-bd9e-505fbf1b0db6/1777922711098_Head%20Shot%20for%20decks%20-%20JP.jpg",
    linkedin_url: "https://www.linkedin.com/in/jean-pierre-cadorette-m-sc-cfa-05882428/",
  },
  {
    email: "vera.tsui@landtoinnovate.org",
    first_name: "Jianshu Vera", last_name: "Cui",
    bio: "Building ecosystems across AI, education, and global markets. Focuses on cross-border strategy, AI-driven youth innovation and entrepreneurship, and the design of platform and partnership ecosystems.",
    profile_picture_url: "https://ccwwdkpafpxfxyuzgmjs.supabase.co/storage/v1/object/public/application-images/8cbeb8b5-f348-4e7c-b309-9fea5f12bf65/9ed833ce-5b3f-49a6-bd9e-505fbf1b0db6/1777928107538_Futuristic%20Neon%20Blue%20And%20Pink%20Light%20Instagram%20Profile%20Picture.png",
    linkedin_url: "https://www.linkedin.com/in/jianshu-cui/",
  },
  {
    email: "james.nguyen@quantropi.com",
    first_name: "James", last_name: "Nguyen",
    bio: "Co-Founder and CEO of Quantropi — securing data and communications against quantum and AI-driven threats. NATO DIANA innovator. CanadianSME Entrepreneur of the Year and Ottawa's Top Forty Under 40.",
    profile_picture_url: "https://ccwwdkpafpxfxyuzgmjs.supabase.co/storage/v1/object/public/application-images/8cbeb8b5-f348-4e7c-b309-9fea5f12bf65/9ed833ce-5b3f-49a6-bd9e-505fbf1b0db6/1777928220370_James_Professional%20Headshot.png",
    linkedin_url: "https://www.linkedin.com/in/jamesnguyen28/",
  },
  {
    email: "david@howtosail.ca",
    first_name: "David", last_name: "Durand",
    bio: "Investor, IP enthusiast, and lawyer.",
    profile_picture_url: "https://ccwwdkpafpxfxyuzgmjs.supabase.co/storage/v1/object/public/application-images/8cbeb8b5-f348-4e7c-b309-9fea5f12bf65/9ed833ce-5b3f-49a6-bd9e-505fbf1b0db6/1777946255343_1517627461556.jfif",
    linkedin_url: "https://www.linkedin.com/in/daviddurandavocat/",
  },
];

async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: { ...headers, "Prefer": "return=representation" }, body: JSON.stringify(body) });
  const text = await res.text();
  return text ? JSON.parse(text) : { _status: res.status };
}
async function patch(url, body) {
  const res = await fetch(url, { method: "PATCH", headers: { ...headers, "Prefer": "return=minimal" }, body: JSON.stringify(body) });
  return res.status;
}
async function get(url) {
  const res = await fetch(url, { headers });
  return res.json();
}

async function main() {
  console.log(`Processing ${applicants.length} applicants...\n`);

  // Step 1: Create auth users
  console.log("=== STEP 1: Creating auth users ===");
  const authResults = {};
  for (const a of applicants) {
    const res = await fetch(`${BASE}/auth/v1/admin/users`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email: a.email, email_confirm: true }),
    });
    const data = await res.json();
    if (data.id) {
      authResults[a.email] = data.id;
      console.log(`  ✓ ${a.email} → auth ${data.id}`);
    } else {
      console.log(`  ✗ ${a.email}: ${JSON.stringify(data)}`);
    }
  }

  // Step 2: Wait for trigger to create user rows, then fetch IDs
  console.log("\n=== STEP 2: Fetching user table IDs ===");
  await new Promise(r => setTimeout(r, 2000)); // give trigger time to fire

  const emails = applicants.map(a => a.email).join(",");
  const usersData = await get(`${BASE}/rest/v1/users?email=in.(${emails})&select=id,email`);
  const userIdByEmail = {};
  for (const u of usersData) userIdByEmail[u.email] = u.id;
  console.log(`  Found ${Object.keys(userIdByEmail).length} user rows`);

  // Step 3: Update user profiles
  console.log("\n=== STEP 3: Updating user profiles ===");
  for (const a of applicants) {
    const userId = userIdByEmail[a.email];
    if (!userId) { console.log(`  ✗ No user row for ${a.email}`); continue; }
    const update = {
      first_name: a.first_name,
      last_name: a.last_name,
      bio: a.bio,
      profile_picture_url: a.profile_picture_url,
      linkedin_url: a.linkedin_url,
    };
    const status = await patch(`${BASE}/rest/v1/users?id=eq.${userId}`, update);
    console.log(`  ${status < 300 ? "✓" : "✗"} ${a.first_name} ${a.last_name || ""} (${a.email}) → HTTP ${status}`);
  }

  // Step 4: Also get existing user IDs for skipped accounts
  console.log("\n=== STEP 4: Fetching existing account user IDs ===");
  const existingEmails = ["rahel.gunaratne@gmail.com","mathew@monvogoventures.com","suzanne@capitalangelinvestors.ca","katie@sheboot.ca","bruce.ford@celestrahealth.com"];
  const existingUsers = await get(`${BASE}/rest/v1/users?email=in.(${existingEmails.join(",")})&select=id,email,first_name`);
  for (const u of existingUsers) {
    userIdByEmail[u.email] = u.id;
    console.log(`  existing: ${u.email} → ${u.id}`);
  }

  // Step 5: Create investor records for both events (skip if already exists)
  console.log("\n=== STEP 5: Creating investor records ===");
  const allEmails = [...applicants.map(a => a.email), ...existingEmails];

  // Build display names
  const nameByEmail = {};
  for (const a of applicants) nameByEmail[a.email] = `${a.first_name}${a.last_name ? " " + a.last_name : ""}`;
  for (const u of existingUsers) nameByEmail[u.email] = u.first_name || u.email.split("@")[0];

  // Check existing investors to avoid duplicates
  const existingInvestors1 = await get(`${BASE}/rest/v1/investors?event_id=eq.${EVENT_1}&select=profile_user_id`);
  const existingInvestors2 = await get(`${BASE}/rest/v1/investors?event_id=eq.${EVENT_2}&select=profile_user_id`);
  const existingUserIds1 = new Set(existingInvestors1.map(i => i.profile_user_id).filter(Boolean));
  const existingUserIds2 = new Set(existingInvestors2.map(i => i.profile_user_id).filter(Boolean));

  let created1 = 0, created2 = 0, skipped = 0;
  for (const email of allEmails) {
    const uid = userIdByEmail[email];
    if (!uid) { console.log(`  ✗ No user ID for ${email}`); continue; }
    const name = nameByEmail[email] || email.split("@")[0];

    for (const [eventId, existingSet, label] of [[EVENT_1, existingUserIds1, "event1"], [EVENT_2, existingUserIds2, "event2"]]) {
      if (existingSet.has(uid)) {
        console.log(`  skip ${name} already investor in ${label}`);
        skipped++;
        continue;
      }
      const res = await post(`${BASE}/rest/v1/investors`, {
        event_id: eventId,
        name,
        initial_balance: 1000000,
        current_balance: 1000000,
        profile_user_id: uid,
      });
      const ok = Array.isArray(res) ? res.length > 0 : (res._status >= 200 && res._status < 300);
      if (ok) {
        if (label === "event1") created1++;
        else created2++;
      } else {
        console.log(`  ✗ ${name} ${label}: ${JSON.stringify(res)}`);
      }
    }
  }
  console.log(`\n  Created ${created1} investors in event 1, ${created2} in event 2, ${skipped} skipped (already existed)`);
  console.log("\nDone!");
}

main().catch(console.error);
