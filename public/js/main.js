const menuButton = document.querySelector('.menu-button');
const mobileMenu = document.querySelector('.mobile-menu');

if (menuButton && mobileMenu) {
  menuButton.addEventListener('click', () => {
    const isOpen = mobileMenu.classList.toggle('is-open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
    mobileMenu.setAttribute('aria-hidden', String(!isOpen));
  });
}

document.querySelectorAll('.password-toggle').forEach((button) => {
  button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.target);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    button.textContent = show ? '○' : '◉';
    button.setAttribute('aria-label', show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
  });
});

document.querySelectorAll('.habit-check').forEach((button) => {
  button.addEventListener('click', () => {
    const habit = button.closest('.habit');
    habit.classList.toggle('habit--done');
    button.textContent = habit.classList.contains('habit--done') ? '✓' : '';
  });
});

window.setTimeout(() => {
  document.querySelector('.toast')?.remove();
}, 4500);
