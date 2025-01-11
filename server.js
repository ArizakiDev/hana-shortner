const express = require('express');
const bodyParser = require('body-parser');
const connectDB = require('./config/db');
const Url = require('./models/Url');
const User = require('./models/User');
const shortid = require('shortid');
const fs = require('fs');
const path = require('path');
const requestIp = require('request-ip');
const session = require('express-session');
const cookieParser = require('cookie-parser');

const app = express();
connectDB();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(requestIp.mw());
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: true
}));
app.use(cookieParser());

const maxUrlsPerDay = 5;
const customUrlsFile = path.join(__dirname, 'url.json');
const baseUrl = ''; // Définir l'URL de base

let customUrls = {};
if (fs.existsSync(customUrlsFile)) {
  customUrls = JSON.parse(fs.readFileSync(customUrlsFile, 'utf8'));
}

const detectLanguage = (req, res, next) => {
  const lang = req.query.lang ||
               req.cookies.preferredLanguage ||
               req.acceptsLanguages(['fr', 'en']) ||
               'fr';

  res.locals.lang = lang;

  if (req.query.lang && req.query.lang !== req.cookies.preferredLanguage) {
    res.cookie('preferredLanguage', lang, { maxAge: 365 * 24 * 60 * 60 * 1000 });
  }

  next();
};

app.use(detectLanguage);

app.get('/', async (req, res) => {
  try {
    const stats = await Promise.all([
      Url.countDocuments(),
      Url.countDocuments({ isActive: true }),
      Url.countDocuments({
        createdAt: {
          $gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }),
      Url.find({}).sort({ clicks: -1 }).limit(5)
    ]);

    const translations = {
      fr: {
        title: 'Transformez Vos Liens',
        subtitle: 'Créez des liens courts et puissants en quelques secondes',
        urlPlaceholder: 'https://votre-url-longue.com',
        buttonText: 'Raccourcir l\'URL',
        statsTitle: 'Statistiques',
        totalUrls: 'URLs créées',
        activeUrls: 'URLs actives',
        lastDayUrls: 'URLs (24h)',
        popularUrls: 'URLs populaires',
        maxPerDay: 'URLs par jour'
      },
      en: {
        title: 'Transform Your Links',
        subtitle: 'Create short, powerful links in seconds',
        urlPlaceholder: 'https://your-long-url.com',
        buttonText: 'Shorten URL',
        statsTitle: 'Statistics',
        totalUrls: 'Created URLs',
        activeUrls: 'Active URLs',
        lastDayUrls: 'URLs (24h)',
        popularUrls: 'Popular URLs',
        maxPerDay: 'URLs per day'
      }
    };

    const dashboardStats = {
      totalUrls: stats[0],
      activeUrls: stats[1],
      lastDayUrls: stats[2],
      popularUrls: stats[3],
      maxUrlsPerDay
    };

    res.render('index', {
      ...dashboardStats,
      translations: translations[res.locals.lang],
      currentLang: res.locals.lang
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.render('index', {
      totalUrls: 0,
      activeUrls: 0,
      lastDayUrls: 0,
      popularUrls: [],
      maxUrlsPerDay,
      translations: translations[res.locals.lang],
      currentLang: res.locals.lang,
      error: 'Une erreur est survenue lors du chargement des statistiques.'
    });
  }
});

app.post('/api/language', (req, res) => {
  const { lang } = req.body;

  if (['fr', 'en'].includes(lang)) {
    res.cookie('preferredLanguage', lang, {
      maxAge: 365 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    });
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Langue non supportée' });
  }
});

app.use((error, req, res, next) => {
  console.error('Erreur serveur:', error);
  res.status(500).render('error', {
    message: res.locals.lang === 'fr' ?
      'Une erreur est survenue sur le serveur.' :
      'A server error occurred.',
    error: process.env.NODE_ENV === 'development' ? error : {}
  });
});

const generateUniqueCode = async () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  let url = await Url.findOne({ shortUrl: `/${code}` });
  while (url) {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    url = await Url.findOne({ shortUrl: `/${code}` });
  }
  return code;
};

app.get('/api/shorten', async (req, res) => {
  console.log('Route /api/shorten called');
  const { originalUrl } = req.query;
  const clientIp = req.clientIp;

  console.log('Original URL:', originalUrl);
  console.log('Client IP:', clientIp);

  if (!originalUrl) {
    console.log('Original URL is required');
    return res.status(400).json({ msg: 'Original URL is required' });
  }

  const today = new Date().toISOString().split('T')[0];
  const urlsToday = await Url.find({
    ipAddress: clientIp,
    createdAt: {
      $gte: new Date(today),
      $lt: new Date(new Date(today).setDate(new Date(today).getDate() + 1))
    }
  });

  console.log('URLs created today:', urlsToday.length);

  if (urlsToday.length >= maxUrlsPerDay) {
    console.log('Maximum URLs per day reached');
    return res.status(400).json({ msg: 'Maximum URLs per day reached' });
  }

  const urlCode = await generateUniqueCode();
  const shortUrl = `/${urlCode}`;

  console.log('Generated short URL:', shortUrl);

  const newUrl = new Url({
    originalUrl,
    shortUrl,
    ipAddress: clientIp
  });

  try {
    await newUrl.save();
    console.log('URL saved successfully');
    res.json({ originalUrl, shortUrl: `${baseUrl}${shortUrl}` });
  } catch (err) {
    console.error('Error saving URL:', err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

app.post('/shorten', async (req, res) => {
  console.log('Route /shorten called');
  const { originalUrl } = req.body;
  const clientIp = req.clientIp;

  console.log('Original URL:', originalUrl);
  console.log('Client IP:', clientIp);

  if (!originalUrl) {
    console.log('Original URL is required');
    return res.status(400).json({ msg: 'Original URL is required' });
  }

  const today = new Date().toISOString().split('T')[0];
  const urlsToday = await Url.find({
    ipAddress: clientIp,
    createdAt: {
      $gte: new Date(today),
      $lt: new Date(new Date(today).setDate(new Date(today).getDate() + 1))
    }
  });

  console.log('URLs created today:', urlsToday.length);

  if (urlsToday.length >= maxUrlsPerDay) {
    console.log('Maximum URLs per day reached');
    return res.status(400).json({ msg: 'Maximum URLs per day reached' });
  }

  const urlCode = await generateUniqueCode();
  const shortUrl = `/${urlCode}`;

  console.log('Generated short URL:', shortUrl);

  const newUrl = new Url({
    originalUrl,
    shortUrl,
    ipAddress: clientIp
  });

  try {
    await newUrl.save();
    console.log('URL saved successfully');
    res.render('result', { originalUrl, shortUrl: `${baseUrl}${shortUrl}` });
  } catch (err) {
    console.error('Error saving URL:', err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

app.get('/urls', async (req, res) => {
  try {
    const urls = await Url.find().sort({ clicks: -1 });
    const totalUrls = await Url.countDocuments();
    const activeUrls = await Url.countDocuments({ isActive: true });
    const translations = {
      fr: {
        title: 'Transformez Vos Liens',
        subtitle: 'Créez des liens courts et puissants en quelques secondes',
        urlPlaceholder: 'https://votre-url-longue.com',
        buttonText: 'Raccourcir l\'URL',
        statsTitle: 'Statistiques',
        totalUrls: 'URLs créées',
        activeUrls: 'URLs actives',
        lastDayUrls: 'URLs (24h)',
        popularUrls: 'URLs populaires',
        maxPerDay: 'URLs par jour'
      },
      en: {
        title: 'Transform Your Links',
        subtitle: 'Create short, powerful links in seconds',
        urlPlaceholder: 'https://your-long-url.com',
        buttonText: 'Shorten URL',
        statsTitle: 'Statistics',
        totalUrls: 'Created URLs',
        activeUrls: 'Active URLs',
        lastDayUrls: 'URLs (24h)',
        popularUrls: 'Popular URLs',
        maxPerDay: 'URLs per day'
      }
    };
    res.render('urls', { urls, baseUrl, translations: translations[res.locals.lang], totalUrls, activeUrls, currentLang: res.locals.lang });
  } catch (err) {
    console.error('Error fetching URLs:', err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

app.get('/:code', async (req, res) => {
  const code = req.params.code;
  console.log('Route /:code called with code:', code);

  if (customUrls[code]) {
    console.log('Custom URL found:', customUrls[code]);
    return res.redirect(customUrls[code]);
  }

  try {
    const url = await Url.findOne({ shortUrl: `/${code}` });
    if (url) {
      console.log('URL found:', url.originalUrl);
      url.clicks += 1;
      await url.save();
      if (url.originalUrl.includes('tiktok.com')) {
        console.log('TikTok URL detected, modifying parameters');
        return res.redirect(url.originalUrl.replace('is_from_webapp=1&sender_device=pc', ''));
      }
      return res.redirect(url.originalUrl);
    } else {
      console.log('URL not found');
      return res.status(404).json({ msg: 'URL not found' });
    }
  } catch (err) {
    console.error('Error finding URL:', err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

app.get('/admin', async (req, res) => {
  console.log('Route /admin called');
  if (!req.session.user) {
    console.log('User not logged in, redirecting to /admin/login');
    return res.redirect('/admin/login');
  }
  try {
    const urls = await Url.find();
    console.log('URLs fetched successfully');
    res.render('admin', { urls, customUrls });
  } catch (err) {
    console.error('Error fetching URLs:', err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

app.post('/admin/delete', async (req, res) => {
  const { id } = req.body;
  try {
    await Url.findByIdAndDelete(id);
    console.log('URL deleted successfully');
    res.redirect('/admin');
  } catch (err) {
    console.error('Error deleting URL:', err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

app.post('/admin/custom', (req, res) => {
  const { code, url } = req.body;
  customUrls[code] = url;
  fs.writeFileSync(customUrlsFile, JSON.stringify(customUrls, null, 2));
  console.log('Custom URL added successfully');
  res.redirect('/admin');
});

app.get('/admin/login', (req, res) => {
  console.log('Route /admin/login called');
  res.render('login');
});

app.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  console.log('Admin login attempt with username:', username);
  try {
    const user = await User.findOne({ username });
    if (user && user.password === password) {
      req.session.user = user;
      console.log('Admin login successful');
      return res.redirect('/admin');
    } else {
      console.log('Invalid credentials');
      return res.status(401).json({ msg: 'Invalid credentials' });
    }
  } catch (err) {
    console.error('Error during admin login:', err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

app.get('/admin/logout', (req, res) => {
  console.log('Admin logout');
  req.session.destroy();
  res.redirect('/admin/login');
});

app.use((req, res) => {
  console.log('404 Error: Page not found');
  res.status(404).render('404', {
    error: "La page que vous recherchez n'existe pas.",
    url: req.url
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
