export function lazyLoad(node) {
    const img = node;

    // start unloaded
    const src = img.getAttribute("data-src");
    img.removeAttribute("src");

    const observer = new IntersectionObserver(
        ([entry]) => {
            if (entry.isIntersecting) {
                img.src = src;
                observer.disconnect();
            }
        },
        {
            rootMargin: "200px",
            threshold: 0.01,
        }
    );

    observer.observe(img);

    return {
        destroy() {
            observer.disconnect();
        },
    };
}
