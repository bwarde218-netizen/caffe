const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', true);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

const DATA_FILE = path.join(__dirname, 'chairs.json');

function readChairsData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
      return [];
    }
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data || '[]');
  } catch (error) {
    console.error('خطأ في قراءة ملف chairs.json:', error);
    return [];
  }
}

function writeChairsData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('خطأ في كتابة ملف chairs.json:', error);
  }
}

// 1. جلب قائمة الكراسين
app.get('/api/chairs', (req, res) => {
  res.json(readChairsData());
});

// 2. إضافة كرسين جديد باستخدام رابط الصورة المباشر
app.post('/api/chairs', (req, res) => {
  try {
    const { name, image, imageUrl } = req.body;
    // دعم استقبال اسم الحقل سواء كان image أو imageUrl
    const finalImage = image || imageUrl;

    if (!name || !finalImage) {
      return res.status(400).json({ message: 'يرجى إدخال اسم الكرسين ورابط الصورة.' });
    }

    const chairs = readChairsData();
    const newChair = {
      id: Date.now(),
      name: name.trim(),
      image: finalImage.trim(), // رابط الصورة المباشر (https://...)
      ratings: []
    };

    chairs.push(newChair);
    writeChairsData(chairs);

    res.status(201).json({ message: 'تمت إضافة الكرسين بنجاح!', chair: newChair });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'حدث خطأ في السيرفر أثناء الإضافة' });
  }
});

// 3. تقييم كرسين
app.post('/api/chairs/:id/rate', (req, res) => {
  const chairId = parseInt(req.params.id);
  const { rating } = req.body;
  const userIp = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || req.socket.remoteAddress;
  const today = new Date().toISOString().slice(0, 10);

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'التقييم يجب أن يكون بين 1 و 5 نجوم.' });
  }

  const chairs = readChairsData();
  const chair = chairs.find(c => c.id === chairId);

  if (!chair) {
    return res.status(404).json({ message: 'الكرسين غير موجود.' });
  }

  if (!chair.ratings) chair.ratings = [];

  const alreadyRatedToday = chair.ratings.some(r => r.ip === userIp && r.date && r.date.startsWith(today));
  if (alreadyRatedToday) {
    return res.status(400).json({ message: 'لقد قمت بتقييم هذا الكرسين اليوم بالفعل!' });
  }

  chair.ratings.push({
    rating: Number(rating),
    ip: userIp,
    date: new Date().toISOString()
  });

  writeChairsData(chairs);
  res.json({ message: 'تم تسليم تقييمك بنجاح!' });
});

// 4. جلب نجم الأسبوع
app.get('/api/weekly-star', (req, res) => {
  const chairs = readChairsData();
  if (chairs.length === 0) return res.json(null);

  let topChair = null;
  let maxAvg = -1;

  chairs.forEach(chair => {
    if (chair.ratings && chair.ratings.length > 0) {
      const sum = chair.ratings.reduce((acc, r) => acc + r.rating, 0);
      const avg = sum / chair.ratings.length;
      if (avg > maxAvg) {
        maxAvg = avg;
        topChair = { ...chair, averageRating: avg.toFixed(1) };
      }
    }
  });

  res.json(topChair);
});

// 5. حذف كرسين
app.delete('/api/chairs/:id', (req, res) => {
  const chairId = parseInt(req.params.id);
  let chairs = readChairsData();

  chairs = chairs.filter(c => c.id !== chairId);
  writeChairsData(chairs);

  res.json({ message: 'تم حذف الكرسين بنجاح!' });
});

app.listen(PORT, () => {
  console.log(`☕ السيرفر يعمل على: http://localhost:${PORT}`);
  console.log(`👑 رابط لوحة التحكم: http://localhost:${PORT}/admin.html`);
});
