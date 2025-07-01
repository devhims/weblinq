export const scrollToSection = (sectionId: string, offset: number = 70) => {
  const section = document.getElementById(sectionId);
  if (section) {
    const elementPosition = section.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - offset;

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth',
    });
  }
};
