
/* ==========================================================
   SKILLMATE — INTEREST-BASED COMMUNITY
   Demo profiles are generated locally.
   Real accounts, connections and messages use the API.
========================================================== */

const API = '/api';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const TOPICS = [
  'AI', 'Python', 'Web Development', 'Startups', 'Music',
  'Gaming', 'Design', 'Robotics', 'Psychology', 'Photography',
  'Finance', 'Movies', 'Data Science', 'Cybersecurity', 'IoT',
  'Writing', 'Fitness', 'Astronomy'
];

const RECOMMENDED_TOPICS = ['AI', 'Python', 'Web Development'];

const FIRST_NAMES = [
  'Aarav', 'Aanya', 'Aditya', 'Aisha', 'Akash', 'Ananya',
  'Arjun', 'Avni', 'Dev', 'Diya', 'Farhan', 'Ishita',
  'Kabir', 'Kavya', 'Krish', 'Meera', 'Mihir', 'Myra',
  'Neel', 'Nisha', 'Parth', 'Priya', 'Rahul', 'Rhea',
  'Rohan', 'Sana', 'Samar', 'Sara', 'Shaurya', 'Siya',
  'Tanvi', 'Vihaan', 'Yash', 'Zoya', 'Aditi'
];

const LAST_NAMES = [
  'Sharma', 'Mehta', 'Verma', 'Patel', 'Gupta', 'Rao',
  'Kapoor', 'Nair', 'Singh', 'Iyer', 'Shah', 'Malhotra',
  'Das', 'Joshi', 'Khan', 'Mishra', 'Desai', 'Bose',
  'Reddy', 'Kulkarni', 'Chopra', 'Saxena', 'Bhat',
  'Sinha', 'Menon', 'Pillai', 'Jain', 'Chawla',
  'Thakur', 'Banerjee'
];

const CITIES = [
  'Delhi', 'Mumbai', 'Bengaluru', 'Hyderabad', 'Pune',
  'Chennai', 'Kolkata', 'Jaipur', 'Ahmedabad', 'Lucknow',
  'Indore', 'Bhopal', 'Kochi', 'Chandigarh', 'Nagpur',
  'Raipur', 'Surat', 'Noida', 'Gurugram', 'Mysuru',
  'Thiruvananthapuram', 'Patna', 'Dehradun', 'Vadodara',
  'Visakhapatnam', 'Ranchi', 'Coimbatore', 'Mangaluru'
];

const ROLE_BY_TOPIC = {
  'AI': ['AI enthusiast', 'Machine learning learner', 'AI researcher'],
  'Python': ['Python developer', 'Automation enthusiast', 'Coding learner'],
  'Web Development': ['Web developer', 'Frontend builder', 'Full-stack learner'],
  'Startups': ['Startup enthusiast', 'Aspiring founder', 'Business builder'],
  'Music': ['Music lover', 'Independent musician', 'Music producer'],
  'Gaming': ['Gamer', 'Game development learner', 'Esports enthusiast'],
  'Design': ['Product designer', 'UI/UX learner', 'Digital creator'],
  'Robotics': ['Robotics enthusiast', 'Hardware builder', 'Robotics learner'],
  'Psychology': ['Psychology enthusiast', 'Behaviour researcher', 'Curious mind'],
  'Photography': ['Photographer', 'Visual storyteller', 'Creative explorer'],
  'Finance': ['Finance enthusiast', 'Economics learner', 'Fintech explorer'],
  'Movies': ['Film buff', 'Cinema enthusiast', 'Storytelling fan'],
  'Data Science': ['Data science learner', 'Data analyst', 'Analytics enthusiast'],
  'Cybersecurity': ['Cybersecurity learner', 'Security enthusiast', 'Ethical security learner'],
  'IoT': ['IoT builder', 'Electronics learner', 'Embedded systems enthusiast'],
  'Writing': ['Writer', 'Storyteller', 'Content creator'],
  'Fitness': ['Fitness enthusiast', 'Wellness explorer', 'Sports enthusiast'],
  'Astronomy': ['Astronomy enthusiast', 'Space explorer', 'Science learner']
};

const TOPIC_ALIASES = {
  'AI': ['artificial intelligence', 'machine learning', 'ml', 'deep learning'],
  'Python': ['python', 'py'],
  'Web Development': ['web development', 'web dev', 'javascript', 'react', 'html', 'css', 'frontend', 'backend', 'full stack'],
  'Startups': ['startup', 'startups', 'entrepreneurship', 'business', 'founder'],
  'Music': ['music', 'singing', 'songwriting', 'musician'],
  'Gaming': ['gaming', 'games', 'esports', 'game development'],
  'Design': ['design', 'figma', 'ui/ux', 'ux', 'ui', 'art', 'product design'],
  'Robotics': ['robotics', 'arduino', 'robot'],
  'Psychology': ['psychology', 'behaviour', 'behavior'],
  'Photography': ['photography', 'photo editing', 'visual storytelling'],
  'Finance': ['finance', 'investing', 'economics', 'fintech'],
  'Movies': ['movies', 'movie', 'cinema', 'film', 'films'],
  'Data Science': ['data science', 'data analytics', 'analytics'],
  'Cybersecurity': ['cybersecurity', 'security', 'ethical hacking'],
  'IoT': ['iot', 'electronics', 'embedded systems'],
  'Writing': ['writing', 'writer', 'storytelling', 'content'],
  'Fitness': ['fitness', 'wellness', 'sports'],
  'Astronomy': ['astronomy', 'space', 'astrophysics']
};

let currentUser = null;
let registeredProfiles = [];
let connectionRows = [];
let connectionsByUserId = new Map();
let activeChatId = null;
let activeChatUser = null;
let socket = null;
let toastTimer = null;
let selectedProfilePhotoFile = null;
let onlyRecommended = false;
let visibleProfileLimit = 24;

const chatCache = new Map();

/* ---------- BASIC HELPERS ---------- */

function safeText(value) {
  return String(value ?? '').trim();
}

function initials(name) {
  return safeText(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0].toUpperCase())
    .join('') || 'S';
}

function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function formatTime(value = new Date()) {
  const date = value instanceof Date
    ? value
    : new Date(String(value).replace(' ', 'T') + 'Z');

  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function showToast(message) {
  const toast = $('#toast');
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add('show');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

async function apiRequest(url, options = {}) {
  const config = {
    credentials: 'same-origin',
    ...options
  };

  if (config.body && !(config.body instanceof FormData)) {
    config.headers = {
      'Content-Type': 'application/json',
      ...config.headers
    };
  }

  const response = await fetch(url, config);

  let data = {};

  try {
    data = await response.json();
  } catch (_) {
    // A response may not contain JSON.
  }

  if (!response.ok) {
    const error = new Error(
      data.error || `Request failed (${response.status}).`
    );

    error.status = response.status;
    throw error;
  }

  return data;
}

/* ---------- 105 DEMO PROFILES ---------- */

function buildDemoProfiles() {
  const profiles = [];

  for (let i = 0; i < 105; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const surnameIndex = (i * 7 + Math.floor(i / FIRST_NAMES.length)) % LAST_NAMES.length;
    const last = LAST_NAMES[surnameIndex];

    const primaryIndex = (i * 7 + 3) % TOPICS.length;
    const secondaryIndex = (i * 11 + 5) % TOPICS.length;
    const tertiaryIndex = (i * 13 + 8) % TOPICS.length;
    const extraIndex = (i * 17 + 2) % TOPICS.length;

    const interests = [...new Set([
      TOPICS[primaryIndex],
      TOPICS[secondaryIndex],
      TOPICS[tertiaryIndex],
      ...(i % 3 === 0 ? [TOPICS[extraIndex]] : [])
    ])];

    const primaryTopic = interests[0];
    const roles = ROLE_BY_TOPIC[primaryTopic] || ['Community member'];

    profiles.push({
      id: `demo-${i + 1}`,
      name: `${first} ${last}`,
      bio: `${roles[i % roles.length]} · ${CITIES[(i * 5 + 2) % CITIES.length]}`,
      city: CITIES[(i * 5 + 2) % CITIES.length],
      interests,
      photo_url: '',
      isDemo: true
    });
  }

  return profiles;
}

const demoProfiles = buildDemoProfiles();

/* ---------- INTEREST PICKERS ---------- */

function selectedFilterTopics() {
  const checked = $$('input[name="filterInterest"]:checked')
    .map(input => input.value);

  if (checked.length) return checked;

  if (currentUser && Array.isArray(currentUser.interests)) {
    return currentUser.interests;
  }

  return [];
}

function selectedSignupTopics() {
  return $$('input[name="signupInterest"]:checked')
    .map(input => input.value);
}

function matchesTopic(profile, topic) {
  const topicAliases = TOPIC_ALIASES[topic] || [topic];
  const content = normalize([
    ...(profile.interests || []),
    profile.name,
    profile.bio
  ].join(' '));

  return topicAliases.some(alias => {
    const term = normalize(alias);
    return term && (` ${content} `).includes(` ${term} `);
  });
}

function matchDetails(profile) {
  const topics = selectedFilterTopics();

  if (!topics.length) {
    return { score: 0, matched: [], total: 0 };
  }

  const matched = topics.filter(topic => matchesTopic(profile, topic));

  return {
    score: Math.round((matched.length / topics.length) * 100),
    matched,
    total: topics.length
  };
}

function updateInterestCount() {
  const filterCount = $('#interestCount');
  const signupCount = $('#signupInterestCount');

  if (filterCount) {
    const n = $$('input[name="filterInterest"]:checked').length;
    filterCount.textContent = `${n} selected`;
  }

  if (signupCount) {
    const n = $$('input[name="signupInterest"]:checked').length;
    signupCount.textContent = `${n} selected`;
  }
}

function setRecommendedSignupInterests() {
  $$('input[name="signupInterest"]').forEach(input => {
    input.checked = RECOMMENDED_TOPICS.includes(input.value);
  });

  updateInterestCount();
}

function selectRecommendedFilters() {
  $$('input[name="filterInterest"]').forEach(input => {
    input.checked = RECOMMENDED_TOPICS.includes(input.value);
  });

  updateInterestCount();
  renderMembers();
}

function clearInterestFilters() {
  $$('input[name="filterInterest"]').forEach(input => {
    input.checked = false;
  });

  updateInterestCount();
  renderMembers();
}

function syncFilterToUser() {
  if (!currentUser || !Array.isArray(currentUser.interests)) return;

  const saved = currentUser.interests.map(normalize);

  $$('input[name="filterInterest"]').forEach(input => {
    input.checked = saved.includes(normalize(input.value));
  });

  updateInterestCount();
}

$$('input[name="filterInterest"]').forEach(input => {
  input.addEventListener('change', () => {
    updateInterestCount();
    visibleProfileLimit = 24;
    renderMembers();
  });
});

$$('input[name="signupInterest"]').forEach(input => {
  input.addEventListener('change', updateInterestCount);
});

/* ---------- MATCH SCORE DISPLAY ---------- */

function updateMatchIndicator() {
  const value = $('#match');
  const note = $('#matchInfo');

  if (!value) return;

  const topics = selectedFilterTopics();
  const profiles = currentUser
    ? [...demoProfiles, ...registeredProfiles]
    : demoProfiles;

  if (!topics.length) {
    value.textContent = String(profiles.length);
    if (note) {
      note.textContent = 'Select an interest to start personalising your recommendations.';
    }
    return;
  }

  const ranked = profiles
    .map(profile => ({ profile, match: matchDetails(profile) }))
    .sort((a, b) => b.match.score - a.match.score);

  const goodMatches = ranked.filter(item => item.match.score > 0).length;

  value.textContent = String(goodMatches);

  if (note) {
    note.textContent = goodMatches
      ? `${goodMatches} profiles share at least one selected interest.`
      : 'No matches for these topics yet. Try choosing a few other interests.';
  }
}

/* ---------- PARTICLES ---------- */

const canvas = $('#particles');
const ctx = canvas ? canvas.getContext('2d') : null;
let particles = [];

function createParticles() {
  if (!canvas || !ctx) return;

  const count = window.innerWidth < 700 ? 20 : 38;

  particles = Array.from({ length: count }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    vx: (Math.random() - 0.5) * 0.22,
    vy: (Math.random() - 0.5) * 0.22,
    size: Math.random() * 1.3 + 0.45
  }));
}

function resizeCanvas() {
  if (!canvas || !ctx) return;

  const ratio = Math.min(window.devicePixelRatio || 1, 1.5);

  canvas.width = Math.floor(window.innerWidth * ratio);
  canvas.height = Math.floor(window.innerHeight * ratio);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  createParticles();
}

function particleLoop() {
  if (!canvas || !ctx) return;

  if (!document.hidden) {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0 || p.x > window.innerWidth) p.vx *= -1;
      if (p.y < 0 || p.y > window.innerHeight) p.vy *= -1;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(150,120,255,.35)';
      ctx.fill();

      for (let j = i + 1; j < particles.length; j++) {
        const q = particles[j];
        const dx = p.x - q.x;
        const dy = p.y - q.y;
        const distanceSquared = dx * dx + dy * dy;

        if (distanceSquared < 8100) {
          const distance = Math.sqrt(distanceSquared);

          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.strokeStyle = `rgba(120,100,255,${0.22 * (1 - distance / 90)})`;
          ctx.stroke();
        }
      }
    }
  }

  requestAnimationFrame(particleLoop);
}

if (canvas && ctx) {
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  particleLoop();
}

/* ---------- AUTH MODAL ---------- */

function openModal(mode = 'login') {
  const modal = $('#modal');
  if (!modal) return;

  modal.style.display = 'flex';
  switchAuth(mode);
  document.body.classList.add('modal-open');
}

function closeModal() {
  const modal = $('#modal');
  if (modal) modal.style.display = 'none';
  document.body.classList.remove('modal-open');
}

function switchAuth(mode) {
  const isLogin = mode !== 'signup';

  $('#loginForm').style.display = isLogin ? 'block' : 'none';
  $('#signupForm').style.display = isLogin ? 'none' : 'block';

  $('#loginTab').classList.toggle('active', isLogin);
  $('#signupTab').classList.toggle('active', !isLogin);

  if (!isLogin) {
    configureSignupForm();
    if (currentUser) fillProfileForm();
  }
}

function configureSignupForm() {
  const heading = $('#signupForm .auth-heading h2');
  const description = $('#signupForm .auth-heading p');
  const submit = $('.signup-submit');
  const email = $('#signupEmail');
  const password = $('#signupPassword');
  const terms = $('.terms');

  if (currentUser) {
    if (heading) heading.textContent = 'Your profile';
    if (description) {
      description.textContent = 'Keep your details and interests up to date.';
    }
    if (submit) submit.innerHTML = 'Save profile changes <span>↗</span>';
    if (terms) terms.textContent = 'Your changes will be stored in your local database.';
    if (email) {
      email.value = currentUser.email || '';
      email.readOnly = true;
    }
    if (password) {
      password.value = '';
      password.placeholder = 'Not needed for profile updates';
    }
  } else {
    if (heading) heading.textContent = "Let's meet.";
    if (description) {
      description.textContent = "A few details help us find people you'll click with.";
    }
    if (submit) submit.innerHTML = 'Create my profile <span>↗</span>';
    if (terms) terms.textContent = 'Your account and interests are saved in your local database.';
    if (email) email.readOnly = false;
    if (password) password.placeholder = 'At least 8 characters';

    setRecommendedSignupInterests();
  }
}

function fillProfileForm() {
  if (!currentUser) return;

  const bits = safeText(currentUser.bio).split(' · ');
  const role = bits.length > 1 ? bits.slice(0, -1).join(' · ') : bits[0];
  const city = bits.length > 1 ? bits[bits.length - 1] : '';

  $('#signupName').value = currentUser.name || '';
  $('#signupCity').value = city || '';
  $('#signupRole').value = role || '';
  $('#signupEmail').value = currentUser.email || '';
  $('#signupPassword').value = '';

  const savedInterests = (currentUser.interests || []).map(normalize);

  $$('input[name="signupInterest"]').forEach(input => {
    input.checked = savedInterests.includes(normalize(input.value));
  });

  selectedProfilePhotoFile = null;

  const preview = $('#photoPreview');
  preview.replaceChildren();

  if (currentUser.photo_url) {
    const image = document.createElement('img');
    image.src = currentUser.photo_url;
    image.alt = 'Current profile photo';
    preview.appendChild(image);
  } else {
    preview.innerHTML = '<span>👤</span>';
  }

  updateInterestCount();
}

function togglePassword(id, button) {
  const input = document.getElementById(id);
  if (!input) return;

  const showing = input.type === 'password';
  input.type = showing ? 'text' : 'password';
  button.textContent = showing ? '◌' : '◉';
  button.setAttribute('aria-label', showing ? 'Hide password' : 'Show password');
}

function setAuthenticatedUser(user) {
  currentUser = user || null;

  const joinButton = $('#joinButton');
  const logoutButton = $('#logoutButton');

  if (joinButton) {
    joinButton.textContent = currentUser ? 'Edit profile ↗' : 'Join ↗';
    joinButton.onclick = () => openModal('signup');
  }

  if (logoutButton) logoutButton.hidden = !currentUser;

  if (currentUser) {
    initializeSocket();
  } else if (socket) {
    socket.disconnect();
    socket = null;
  }
}

async function loginUser() {
  const email = safeText($('#loginEmail').value);
  const password = $('#loginPassword').value || '';

  if (!email || !password) {
    showToast('Enter your email and password.');
    return;
  }

  try {
    const result = await apiRequest(`${API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    setAuthenticatedUser(result.user);
    syncFilterToUser();
    closeModal();

    $('#loginPassword').value = '';

    await loadConnections();
    await refreshMembers();

    showToast(`Welcome back, ${result.user.name}!`);
  } catch (error) {
    showToast(error.message);
  }
}

async function signupUser() {
  const isNewUser = !currentUser;
  const name = safeText($('#signupName').value);
  const city = safeText($('#signupCity').value);
  const role = safeText($('#signupRole').value);
  const email = safeText($('#signupEmail').value);
  const password = $('#signupPassword').value || '';
  const interests = selectedSignupTopics();

  if (!name || !city || !role || !email || interests.length === 0) {
    showToast('Complete your details and select at least one interest.');
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast('Enter a valid email address.');
    return;
  }

  if (isNewUser && password.length < 8) {
    showToast('Use a password with at least 8 characters.');
    return;
  }

  const bio = `${role} · ${city}`.slice(0, 500);

  try {
    let result;

    if (currentUser) {
      result = await apiRequest(`${API}/profile`, {
        method: 'PUT',
        body: JSON.stringify({ name, bio, interests })
      });
    } else {
      result = await apiRequest(`${API}/auth/register`, {
        method: 'POST',
        body: JSON.stringify({ name, email, password, bio, interests })
      });

      setAuthenticatedUser(result.user);
    }

    let updatedUser = result.user || currentUser;

    if (selectedProfilePhotoFile) {
      const form = new FormData();
      form.append('photo', selectedProfilePhotoFile);

      try {
        const photoResult = await apiRequest(`${API}/upload/photo`, {
          method: 'POST',
          body: form
        });

        updatedUser = {
          ...updatedUser,
          photo_url: photoResult.photo_url
        };
      } catch (photoError) {
        showToast(`Profile saved, but photo upload failed: ${photoError.message}`);
      }
    }

    setAuthenticatedUser(updatedUser);
    closeModal();
    resetSignupForm();
    syncFilterToUser();

    await loadConnections();
    await refreshMembers();

    showToast(
      isNewUser
        ? `Welcome to SkillMate, ${name}!`
        : 'Your profile has been updated.'
    );
  } catch (error) {
    showToast(error.message);
  }
}

function resetSignupForm() {
  [
    'signupName', 'signupCity', 'signupRole',
    'signupEmail', 'signupPassword'
  ].forEach(id => {
    const input = document.getElementById(id);
    if (input) input.value = '';
  });

  const photo = $('#signupPhoto');
  if (photo) photo.value = '';

  selectedProfilePhotoFile = null;

  const preview = $('#photoPreview');
  if (preview) preview.innerHTML = '<span>👤</span>';

  setRecommendedSignupInterests();
}

async function logoutUser() {
  try {
    await apiRequest(`${API}/auth/logout`, { method: 'POST' });
  } catch (_) {
    // Session might already have expired.
  }

  if (socket) socket.disconnect();
  window.location.reload();
}

/* ---------- PHOTO PREVIEW ---------- */

const photoInput = $('#signupPhoto');

if (photoInput) {
  photoInput.addEventListener('change', () => {
    const file = photoInput.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

    if (!allowed.includes(file.type)) {
      showToast('Choose a JPG, PNG, WEBP or GIF image.');
      photoInput.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('Please choose a photo smaller than 5 MB.');
      photoInput.value = '';
      return;
    }

    selectedProfilePhotoFile = file;

    const reader = new FileReader();

    reader.onload = () => {
      const preview = $('#photoPreview');
      preview.replaceChildren();

      const image = document.createElement('img');
      image.src = String(reader.result || '');
      image.alt = 'Profile photo preview';

      preview.appendChild(image);
    };

    reader.onerror = () => showToast('Could not read that image.');

    reader.readAsDataURL(file);
  });
}

/* ---------- RECOMMENDATION CONTROLS ---------- */

function toggleRecommendedOnly() {
  onlyRecommended = !onlyRecommended;
  visibleProfileLimit = 24;

  const button = $('#recommendationToggle');

  if (button) {
    button.textContent = onlyRecommended
      ? 'Show everyone'
      : 'Show best matches';

    button.classList.toggle('filter-active', onlyRecommended);
  }

  renderMembers();
}

function clearSearch() {
  const input = $('#search');
  if (input) input.value = '';

  visibleProfileLimit = 24;
  renderMembers();
}

function scrollToDiscover() {
  $('#discover')?.scrollIntoView({ behavior: 'smooth' });
}

/* ---------- PROFILE CARD CREATION ---------- */

function makeAvatar(name, photo = '') {
  const avatar = document.createElement('div');
  avatar.className = 'avatar';

  if (photo) {
    const image = document.createElement('img');
    image.src = photo;
    image.alt = `${name}'s profile photo`;
    avatar.appendChild(image);
  } else {
    avatar.textContent = initials(name);
  }

  return avatar;
}

function enableTilt(card) {
  if (
    window.matchMedia('(hover: none)').matches ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return;
  }

  card.addEventListener('mousemove', event => {
    const rect = card.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const rotateX = ((y - rect.height / 2) / 26) * -1;
    const rotateY = (x - rect.width / 2) / 26;

    card.style.transform =
      `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-3px)`;
  });

  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
  });
}

function profileSearchText(profile) {
  return normalize([
    profile.name,
    profile.bio,
    profile.city,
    ...(profile.interests || [])
  ].join(' '));
}

function getDisplayProfiles() {
  if (!currentUser) return [...demoProfiles];

  const realProfiles = registeredProfiles.filter(
    profile => Number(profile.id) !== Number(currentUser.id)
  );

  return [...demoProfiles, ...realProfiles.map(profile => ({
    ...profile,
    isDemo: false
  }))];
}

function makeProfileCard(profile) {
  const card = document.createElement('article');
  const isDemo = profile.isDemo === true;
  const match = matchDetails(profile);

  card.className = 'person tilt';
  card.dataset.userId = String(profile.id);
  card.dataset.search = profileSearchText(profile);

  const top = document.createElement('div');
  top.className = 'person-top';
  top.appendChild(makeAvatar(profile.name, profile.photo_url || ''));

  const badge = document.createElement('span');
  badge.className = 'online';

  const dot = document.createElement('i');
  badge.appendChild(dot);
  badge.append(document.createTextNode(
    match.score > 0 ? ` ${match.score}% MATCH` : ' MEMBER'
  ));

  top.appendChild(badge);
  card.appendChild(top);

  const name = document.createElement('h3');
  name.textContent = profile.name || 'SkillMate member';
  card.appendChild(name);

  const role = document.createElement('div');
  role.className = 'role';
  role.textContent = profile.bio || 'Community member';
  card.appendChild(role);

  const tags = document.createElement('div');
  tags.className = 'tags';

  (profile.interests || []).slice(0, 4).forEach(interest => {
    const tag = document.createElement('span');
    tag.textContent = interest;
    tags.appendChild(tag);
  });

  card.appendChild(tags);

  const footer = document.createElement('div');
  footer.className = 'profile-card-footer';

  const location = document.createElement('span');
  location.className = 'profile-location';
  location.textContent = profile.city || 'India';

  const actions = document.createElement('div');
  actions.className = 'person-actions';

  const connectButton = document.createElement('button');
  connectButton.className = 'connect';
  connectButton.type = 'button';

  const messageButton = document.createElement('button');
  messageButton.className = 'message-btn';
  messageButton.type = 'button';
  messageButton.textContent = '✉ Message';

  if (isDemo) {
    connectButton.textContent = 'Connect';
    connectButton.addEventListener('click', () => connect(connectButton, profile));
    messageButton.addEventListener('click', () => {
      showToast('This is a demo profile. Real chat needs a registered member.');
    });
  } else {
    const relationship = connectionsByUserId.get(Number(profile.id));

    if (relationship?.status === 'accepted') {
      connectButton.textContent = '✓ Connected';
      connectButton.disabled = true;
      connectButton.classList.add('connected');
    } else if (
      relationship?.status === 'pending' &&
      Number(relationship.recipient_id) === Number(currentUser?.id)
    ) {
      connectButton.textContent = 'Accept request';
      connectButton.addEventListener('click', () =>
        acceptConnection(relationship.connection_id)
      );
    } else if (relationship?.status === 'pending') {
      connectButton.textContent = 'Requested';
      connectButton.disabled = true;
    } else {
      connectButton.textContent = 'Connect';
      connectButton.addEventListener('click', () => connect(connectButton, profile));
    }

    messageButton.addEventListener('click', () => {
      if (relationship?.status !== 'accepted') {
        showToast('Accept the connection before messaging.');
        return;
      }

      openChat(Number(profile.id));
    });
  }

  actions.append(connectButton, messageButton);
  footer.appendChild(location);
  card.appendChild(footer);
  card.appendChild(actions);

  enableTilt(card);

  return card;
}

function renderMembers() {
  const people = $('#people');
  const noResults = $('#noResults');

  if (!people) return;

  const query = normalize($('#search')?.value);
  const topics = selectedFilterTopics();

  let profiles = getDisplayProfiles().map(profile => ({
    profile,
    match: matchDetails(profile)
  }));

  profiles.sort((a, b) =>
    b.match.score - a.match.score ||
    String(a.profile.name).localeCompare(String(b.profile.name))
  );

  if (onlyRecommended && topics.length) {
    profiles = profiles.filter(item => item.match.score > 0);
  }

  if (query) {
    profiles = profiles.filter(item =>
      profileSearchText(item.profile).includes(query)
    );
  }

  const total = profiles.length;
  const visible = profiles.slice(0, visibleProfileLimit);

  people.replaceChildren();

  visible.forEach(item => {
    people.appendChild(makeProfileCard(item.profile));
  });

  if (noResults) {
    noResults.hidden = total !== 0;
    noResults.textContent = query
      ? 'No profiles match your search. Try another name or interest.'
      : 'No matching profiles yet. Try a different interest.';
  }

  const count = $('#profileCount');

  if (count) {
    count.textContent = currentUser
      ? `${total} profiles · demo + registered members`
      : `${total} demo profiles`;
  }

  const summary = $('#discoverySummary');

  if (summary) {
    summary.textContent = topics.length
      ? `${total} profiles · ranked by ${topics.slice(0, 3).join(', ')}${topics.length > 3 ? ' and more' : ''}`
      : `${total} demo profiles · choose interests for recommendations`;
  }

  const moreButton = $('#showMoreButton');

  if (moreButton) {
    moreButton.hidden = total <= visible.length;
    moreButton.textContent = `Load more people (${Math.min(24, total - visible.length)}) ↓`;
  }

  updateMatchIndicator();
  updateInterestCount();
}

function showMoreProfiles() {
  visibleProfileLimit += 24;
  renderMembers();
}

async function refreshMembers() {
  if (!currentUser) {
    registeredProfiles = [];
    renderMembers();
    return;
  }

  try {
    const result = await apiRequest(`${API}/profiles`);
    registeredProfiles = result.profiles || [];
    renderMembers();
  } catch (error) {
    showToast(error.message);
  }
}

const searchInput = $('#search');

if (searchInput) {
  searchInput.addEventListener('input', () => {
    visibleProfileLimit = 24;
    renderMembers();
  });
}

/* ---------- CONNECTIONS ---------- */

async function loadConnections() {
  if (!currentUser) {
    connectionRows = [];
    connectionsByUserId = new Map();
    renderContacts();

    const count = $('#chatCount');
    if (count) count.textContent = '0';

    return;
  }

  try {
    const result = await apiRequest(`${API}/connections`);

    connectionRows = result.connections || [];
    connectionsByUserId = new Map();

    connectionRows.forEach(row => {
      if (row.user) {
        connectionsByUserId.set(Number(row.user.id), row);
      }
    });

    const count = $('#chatCount');

    if (count) {
      count.textContent = String(
        connectionRows.filter(row => row.status === 'accepted').length
      );
    }

    renderMembers();
    renderContacts();
  } catch (error) {
    showToast(error.message);
  }
}

async function connect(button, profile) {
  if (!currentUser) {
    showToast('Log in to send real connection requests.');
    openModal('login');
    return;
  }

  if (profile?.isDemo || String(profile?.id).startsWith('demo-')) {
    showToast('Demo profile only. Use a second registered account to test connections.');
    return;
  }

  try {
    await apiRequest(`${API}/connections/request/${profile.id}`, {
      method: 'POST'
    });

    await loadConnections();

    showToast('Connection request sent.');
  } catch (error) {
    showToast(error.message);
  }
}

async function acceptConnection(connectionId) {
  try {
    await apiRequest(`${API}/connections/${connectionId}/accept`, {
      method: 'POST'
    });

    await loadConnections();

    showToast('Connection accepted. You can now chat.');
  } catch (error) {
    showToast(error.message);
  }
}

function connectedProfiles() {
  return connectionRows
    .filter(row => row.status === 'accepted' && row.user)
    .map(row => row.user);
}

/* ---------- CHAT ---------- */

const chatDrawer = $('#chatDrawer');
const chatBackdrop = $('#chatBackdrop');
const chatMessages = $('#chatMessages');
const chatContacts = $('#chatContacts');

function initializeSocket() {
  if (!currentUser || typeof window.io !== 'function') return;

  if (socket) socket.disconnect();

  socket = window.io();

  socket.on('message:new', message => {
    const otherId =
      Number(message.sender_id) === Number(currentUser.id)
        ? Number(message.recipient_id)
        : Number(message.sender_id);

    if (activeChatId === otherId) {
      loadMessages(otherId);
    } else if (Number(message.sender_id) !== Number(currentUser.id)) {
      showToast('You received a new message.');
    }
  });
}

function openChat(personId) {
  if (!currentUser) {
    showToast('Log in to view your connections and messages.');
    openModal('login');
    return;
  }

  const contacts = connectedProfiles();

  if (personId !== undefined && personId !== null && personId !== '') {
    activeChatId = Number(personId);
    activeChatUser = contacts.find(
      user => Number(user.id) === activeChatId
    ) || null;

    if (!activeChatUser) {
      showToast('This member is not an accepted connection yet.');
      return;
    }
  } else if (
    !activeChatId ||
    !contacts.some(user => Number(user.id) === activeChatId)
  ) {
    activeChatUser = contacts[0] || null;
    activeChatId = activeChatUser ? Number(activeChatUser.id) : null;
  } else {
    activeChatUser = contacts.find(
      user => Number(user.id) === activeChatId
    ) || activeChatUser;
  }

  chatDrawer.classList.add('open');
  chatDrawer.setAttribute('aria-hidden', 'false');
  chatBackdrop.classList.add('open');
  document.body.classList.add('chat-open');

  renderContacts();
  renderActiveChat();

  if (activeChatId) loadMessages(activeChatId);

  setTimeout(() => $('#chatInput')?.focus(), 200);
}

function closeChat() {
  chatDrawer.classList.remove('open');
  chatDrawer.setAttribute('aria-hidden', 'true');
  chatBackdrop.classList.remove('open');
  document.body.classList.remove('chat-open');
}

function renderContacts() {
  if (!chatContacts) return;

  const query = normalize($('#chatSearch')?.value);
  chatContacts.replaceChildren();

  const contacts = connectedProfiles().filter(user =>
    normalize(`${user.name} ${(user.interests || []).join(' ')}`).includes(query)
  );

  if (!currentUser || !contacts.length) {
    const empty = document.createElement('div');
    empty.className = 'chat-empty';
    empty.textContent = !currentUser
      ? 'Log in to see your connections.'
      : 'Accepted connections will appear here.';

    chatContacts.appendChild(empty);
    return;
  }

  contacts.forEach(user => {
    const item = document.createElement('button');

    item.type = 'button';
    item.className =
      `chat-contact${Number(user.id) === activeChatId ? ' active' : ''}`;

    item.addEventListener('click', () => {
      activeChatId = Number(user.id);
      activeChatUser = user;
      renderContacts();
      renderActiveChat();
      loadMessages(activeChatId);
    });

    const avatar = document.createElement('div');
    avatar.className = 'chat-avatar';

    if (user.photo_url) {
      const image = document.createElement('img');
      image.src = user.photo_url;
      image.alt = '';
      avatar.appendChild(image);
    } else {
      avatar.textContent = initials(user.name);
    }

    const copy = document.createElement('div');
    copy.className = 'chat-contact-copy';

    const line = document.createElement('div');
    line.className = 'chat-contact-line';

    const strong = document.createElement('strong');
    strong.textContent = user.name;

    const time = document.createElement('time');
    time.textContent = '';

    line.append(strong, time);

    const preview = document.createElement('span');
    preview.className = 'chat-contact-preview';

    const thread = chatCache.get(Number(user.id)) || [];
    const last = thread[thread.length - 1];

    preview.textContent = last
      ? (last.body || 'Start chatting')
      : 'Connected on SkillMate';

    copy.append(line, preview);
    item.append(avatar, copy);
    chatContacts.appendChild(item);
  });
}

function renderActiveChat() {
  const user = activeChatUser;
  const avatar = $('#activeChatAvatar');
  const name = $('#activeChatName');
  const topic = $('#activeChatTopic');

  if (avatar) {
    avatar.replaceChildren();
    avatar.className = 'chat-avatar';

    if (user?.photo_url) {
      const image = document.createElement('img');
      image.src = user.photo_url;
      image.alt = '';
      avatar.appendChild(image);
    } else {
      avatar.textContent = user ? initials(user.name) : '✦';
    }
  }

  if (name) name.textContent = user?.name || 'Your conversations';

  if (topic) {
    topic.textContent = user
      ? ((user.interests || []).join(' · ') || 'SkillMate member')
      : 'Connect with members to get started';
  }

  const input = $('#chatInput');
  const send = $('.send-button');
  const attach = $('.composer-attach');

  if (input) input.disabled = !user;
  if (send) send.disabled = !user;
  if (attach) attach.disabled = !user;

  renderMessages();
}

async function loadMessages(userId) {
  if (!currentUser || !userId) return;

  try {
    const result = await apiRequest(`${API}/messages/${userId}`);
    chatCache.set(Number(userId), result.messages || []);

    if (activeChatId === Number(userId)) renderMessages();

    renderContacts();
  } catch (error) {
    if (error.status !== 403) showToast(error.message);
  }
}

function renderMessages() {
  if (!chatMessages) return;

  chatMessages.replaceChildren();

  const label = document.createElement('div');
  label.className = 'chat-day-label';
  label.textContent = activeChatUser ? 'YOUR CONVERSATION' : 'YOUR NETWORK';
  chatMessages.appendChild(label);

  if (!activeChatUser || !activeChatId) {
    const empty = document.createElement('div');
    empty.className = 'chat-empty';
    empty.innerHTML = '<span>✦</span><div>Connect with a registered member to start chatting.</div>';
    chatMessages.appendChild(empty);
    return;
  }

  const thread = chatCache.get(Number(activeChatId)) || [];

  if (!thread.length) {
    const empty = document.createElement('div');
    empty.className = 'chat-empty';
    empty.innerHTML = '<span>✦</span><div>Say hello and start with something you have in common.</div>';
    chatMessages.appendChild(empty);
    return;
  }

  thread.forEach(message => {
    const mine = Number(message.sender_id) === Number(currentUser.id);
    const row = document.createElement('div');
    row.className = `message-row ${mine ? 'mine' : 'theirs'}`;

    if (!mine) {
      const mini = document.createElement('div');
      mini.className = 'message-mini-avatar';
      mini.textContent = initials(activeChatUser.name);
      row.appendChild(mini);
    }

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    if (message.body) {
      const text = document.createElement('div');
      text.textContent = message.body;
      bubble.appendChild(text);
    }

    const time = document.createElement('span');
    time.className = 'message-time';
    time.textContent = formatTime(message.created_at);
    bubble.appendChild(time);

    row.appendChild(bubble);
    chatMessages.appendChild(row);
  });

  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendChatMessage(text) {
  const body = safeText(text);

  if (!body) return;

  if (!currentUser || !activeChatId || !activeChatUser) {
    showToast('Select an accepted connection first.');
    return;
  }

  try {
    await apiRequest(`${API}/messages/${activeChatId}`, {
      method: 'POST',
      body: JSON.stringify({ body })
    });

    $('#chatInput').value = '';
    await loadMessages(activeChatId);
    $('#chatInput')?.focus();
  } catch (error) {
    showToast(error.message);
  }
}

$('#chatForm')?.addEventListener('submit', event => {
  event.preventDefault();
  sendChatMessage($('#chatInput')?.value || '');
});

$('#chatSearch')?.addEventListener('input', renderContacts);

$('#chatAttachment')?.addEventListener('change', event => {
  if (event.target.files?.length) {
    showToast('Image messages are not enabled yet; text chat is ready.');
    event.target.value = '';
  }
});

function showChatInfo() {
  if (!activeChatUser) {
    showToast('Select an accepted connection first.');
    return;
  }

  showToast(
    `${activeChatUser.name} · ${(activeChatUser.interests || []).join(', ')}`
  );
}

/* ---------- MODAL AND INITIALISATION ---------- */

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    closeModal();
    closeChat();
  }

  if (event.key === 'Enter' && $('#modal')?.style.display === 'flex') {
    if (event.target instanceof HTMLInputElement && event.target.type !== 'file') {
      event.preventDefault();

      const signupVisible = $('#signupForm').style.display !== 'none';

      if (signupVisible) signupUser();
      else loginUser();
    }
  }
});

$('#modal')?.addEventListener('click', event => {
  if (event.target === $('#modal')) closeModal();
});

async function initializeApp() {
  updateInterestCount();
  renderMembers();

  try {
    const result = await apiRequest(`${API}/auth/me`);

    setAuthenticatedUser(result.user);
    syncFilterToUser();

    await loadConnections();
    await refreshMembers();
  } catch (_) {
    setAuthenticatedUser(null);
    renderContacts();
    renderMembers();
  }
}

initializeApp();
