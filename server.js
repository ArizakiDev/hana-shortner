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
const baseUrl = '';

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

app.get('/api/shorten', async (req, res) => {
  const { originalUrl } = req.query;
  const clientIp = req.clientIp;

  if (!originalUrl) {
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

  if (urlsToday.length >= maxUrlsPerDay) {
    return res.status(400).json({ msg: 'Maximum URLs per day reached' });
  }

  const urlCode = shortid.generate();
  const shortUrl = `/p/${urlCode}`;

  const newUrl = new Url({
    originalUrl,
    shortUrl,
    ipAddress: clientIp
  });

  try {
    await newUrl.save();
    res.json({ originalUrl, shortUrl: `${baseUrl}${shortUrl}` });
  } catch (err) {
    res.status(500).json({ msg: 'Server Error' });
  }
});

app.get('/p/:code', async (req, res) => {
  const code = req.params.code;
  if (customUrls[code]) {
    return res.redirect(customUrls[code]);
  }

  try {
    const url = await Url.findOne({ shortUrl: `/p/${code}` });
    if (url) {
      return res.redirect(url.originalUrl);
    } else {
      return res.status(404).json({ msg: 'URL not found' });
    }
  } catch (err) {
    res.status(500).json({ msg: 'Server Error' });
  }
});

app.get('/admin', async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/admin/login');
  }
  try {
    const urls = await Url.find();
    res.render('admin', { urls, customUrls });
  } catch (err) {
    res.status(500).json({ msg: 'Server Error' });
  }
});

app.post('/admin/delete', async (req, res) => {
  const { id } = req.body;
  try {
    await Url.findByIdAndDelete(id);
    res.redirect('/admin');
  } catch (err) {
    res.status(500).json({ msg: 'Server Error' });
  }
});

app.post('/admin/custom', (req, res) => {
  const { code, url } = req.body;
  customUrls[code] = url;
  fs.writeFileSync(customUrlsFile, JSON.stringify(customUrls, null, 2));
  res.redirect('/admin');
});

app.get('/admin/login', (req, res) => {
  res.render('login');
});

app.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user && user.password === password) {
      req.session.user = user;
      return res.redirect('/admin');
    } else {
      return res.status(401).json({ msg: 'Invalid credentials' });
    }
  } catch (err) {
    res.status(500).json({ msg: 'Server Error' });
  }
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

app.use((req, res) => {
  res.status(404).render('404', {
    error: "La page que vous recherchez n'existe pas.",
    url: req.url
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
