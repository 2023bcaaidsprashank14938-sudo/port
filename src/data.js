// ✏️ EDIT YOUR CONTENT HERE — no need to touch main.js
export const profile = {
  name: 'Prashank Pandey',
  role: 'Business Analyst · Data & Technology Enthusiast',
  email: 'prashankoandey28@gmail.com', // ⚠️ check spelling: "pandey" vs "oandey"?
  phone: '9340589612',
  linkedin: 'https://www.linkedin.com/in/prashank-pandey/',
  github: '', // add your GitHub URL to show a button
  resume: ''  // e.g. '/resume.pdf' (put the file in /public) to show a button
};

export const sections = [
  {
    id: 'about', nav: 'About', kicker: 'GET TO KNOW ME', title: profile.name,
    color: '#5b8cff', x: -12, z: -12, height: 5, icon: 'icosa',
    paragraphs: [
      'I am a final-year BCA student at Poornima University, interested in business analysis, data analytics, and technology.'
    ],
    facts: [
      ['Education', 'BCA · Poornima University (final year)'],
      ['Focus', 'Business analysis & data analytics'],
      ['Interests', 'Dashboards, reporting, process improvement']
    ]
  },
  {
    id: 'projects', nav: 'Projects', kicker: 'MY WORK', title: 'Featured Projects',
    color: '#b36bff', x: 12, z: -12, height: 7, icon: 'cube',
    projects: [
      { title: 'Blinkit Sales Analytics', desc: 'A Power BI dashboard exploring sales and product performance.', tags: ['Power BI', 'Dashboard'], link: '' },
      { title: 'Netflix Content Analytics', desc: 'Analysis of movies, shows, genres, and content trends.', tags: ['Analytics', 'Trends'], link: '' },
      { title: 'SEO Performance Analytics', desc: 'Tracking organic traffic, keyword rankings, and conversion metrics.', tags: ['SEO', 'Reporting'], link: '' }
    ]
  },
  {
    id: 'skills', nav: 'Skills', kicker: 'WHAT I DO', title: 'Skills & Expertise',
    color: '#ff9f43', x: -12, z: 12, height: 5.8, icon: 'octa',
    groups: [
      { name: 'Business Analysis', items: ['Requirement gathering', 'Documentation', 'User stories', 'Stakeholder communication'] },
      { name: 'Data Analytics', items: ['SQL', 'Python', 'Excel', 'Power BI', 'Tableau'] },
      { name: 'Ways of Working', items: ['Agile', 'Scrum', 'Reporting', 'Process improvement'] }
    ]
  },
  {
    id: 'contact', nav: 'Contact', kicker: 'LET’S CONNECT', title: 'Contact Me',
    color: '#2ee6b6', x: 12, z: 12, height: 4.2, icon: 'torus',
    paragraphs: ['Thanks for visiting my portfolio! Reach out or connect with me professionally.']
  }
];
