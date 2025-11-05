// basic tab switching
document.querySelectorAll('nav.tabs button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('nav.tabs button').forEach(b=>b.classList.remove('active'));
    document.getElementById(btn.dataset.tab).classList.add('active');
    btn.classList.add('active');
  });
});
document.getElementById('status').textContent = 'ready';

