'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FaLungs } from 'react-icons/fa'
import "./app.css"
import { useEffect, useState, useMemo, useRef, useCallback } from "react";


const AnimatedSection = ({ children, className = "", delay = 0 }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(true);
        }, delay);

        return () => clearTimeout(timer);
    }, [delay]);

    return (
        <div className={`animated-section ${isVisible ? 'visible' : ''} ${className}`}>
            {children}
        </div>
    );
};

const ScrollRevealSection = ({ children, className = "" }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [elementRef, setElementRef] = useState(null);

    useEffect(() => {
        if (!elementRef) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                }
            },
            {
                threshold: 0.1,
                rootMargin: '50px 0px'
            }
        );

        observer.observe(elementRef);

        return () => {
            if (elementRef) {
                observer.unobserve(elementRef);
            }
            observer.disconnect();
        };
    }, [elementRef]);

    return (
        <div
            ref={setElementRef}
            className={`scroll-reveal ${isVisible ? 'visible' : ''} ${className}`}
        >
            {children}
        </div>
    );
};

const FeatureCard = ({ icon, title, description, features, image, delay = 0 }) => (
    <ScrollRevealSection className="feature-card group">
        <div className="feature-card-inner">
            <div className="feature-image-container">
                <img src={image} alt={title} className="feature-image" />
                <div className="feature-overlay"></div>
            </div>
            <div className="feature-content">
                <div className="feature-icon">{icon}</div>
                <h3 className="feature-title">{title}</h3>
                <p className="feature-description">{description}</p>
                <ul className="feature-list">
                    {features.map((feature, index) => (
                        <li key={index} className="feature-item">
                            <span className="feature-bullet"></span>
                            {feature}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    </ScrollRevealSection>
);

const BenefitItem = ({ title, description, delay = 0 }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [elementRef, setElementRef] = useState(null);

    useEffect(() => {
        if (!elementRef) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setTimeout(() => {
                        setIsVisible(true);
                    }, delay);
                }
            },
            {
                threshold: 0.1,
                rootMargin: '50px 0px'
            }
        );

        observer.observe(elementRef);

        return () => {
            if (elementRef) {
                observer.unobserve(elementRef);
            }
            observer.disconnect();
        };
    }, [elementRef, delay]);

    return (
        <div
            ref={setElementRef}
            className={`benefit-item scroll-reveal ${isVisible ? 'visible' : ''}`}
        >
            <h3 className="benefit-title">{title}</h3>
            <p className="benefit-description">{description}</p>
        </div>
    );
};

const Home = () => {
    const router = useRouter();
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [isCheckingLaunch, setIsCheckingLaunch] = useState(true);
    const [showLanding, setShowLanding] = useState(false);
    const carouselRef = useRef(null);
    const [activeSlide, setActiveSlide] = useState(0);
    const [isCarouselPaused, setIsCarouselPaused] = useState(false);
    const AUTO_SCROLL_INTERVAL = 8000;

    const featureSlides = useMemo(() => ([
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'data', label: 'Data' },
        { id: 'ml', label: 'Machine Learning' },
        { id: 'spatial', label: 'Spatial Analysis' }
    ]), []);
    const slideCount = featureSlides.length;

    const pauseCarousel = useCallback(() => setIsCarouselPaused(true), []);
    const resumeCarousel = useCallback(() => setIsCarouselPaused(false), []);

    const goToSlide = useCallback((index) => {
        const node = carouselRef.current;
        if (!node || slideCount === 0) return;

        const width = node.clientWidth;
        if (width === 0) return;

        const targetIndex = ((index % slideCount) + slideCount) % slideCount;
        node.scrollTo({
            left: width * targetIndex,
            behavior: 'smooth'
        });
        setActiveSlide(targetIndex);
    }, [slideCount]);

    const handleScroll = useCallback(() => {
        const node = carouselRef.current;
        if (!node || slideCount === 0) return;

        const width = node.clientWidth;
        if (width === 0) return;

        const index = Math.round(node.scrollLeft / width);
        const clamped = Math.max(0, Math.min(index, slideCount - 1));
        setActiveSlide(prev => (prev === clamped ? prev : clamped));
    }, [slideCount]);

    const handleKeyDown = useCallback((event) => {
        if (slideCount === 0) return;

        if (event.key === 'ArrowRight') {
            event.preventDefault();
            pauseCarousel();
            goToSlide(activeSlide + 1);
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            pauseCarousel();
            goToSlide(activeSlide - 1);
        }
    }, [activeSlide, goToSlide, pauseCarousel, slideCount]);

    const handleBlur = useCallback((event) => {
        const currentTarget = event.currentTarget;
        if (currentTarget.contains(event.relatedTarget)) {
            return;
        }
        resumeCarousel();
    }, [resumeCarousel]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const hasVisited = window.localStorage.getItem('hasVisitedLanding') === 'true';

        if (hasVisited) {
            router.replace('/dashboard');
            setShowLanding(false);
            setIsCheckingLaunch(false);
            return;
        }

        setShowLanding(true);
        setIsCheckingLaunch(false);
    }, [router]);

    useEffect(() => {
        const handleMouseMove = (e) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    useEffect(() => {
        if (isCarouselPaused || slideCount === 0) return;

        const intervalId = window.setInterval(() => {
            goToSlide(activeSlide + 1);
        }, AUTO_SCROLL_INTERVAL);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [AUTO_SCROLL_INTERVAL, activeSlide, goToSlide, isCarouselPaused, slideCount]);

    useEffect(() => {
        const handleResize = () => {
            const node = carouselRef.current;
            if (!node || slideCount === 0) return;
            node.scrollTo({
                left: node.clientWidth * activeSlide,
                behavior: 'auto'
            });
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [activeSlide, slideCount]);


    const handleGetStarted = () => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem('hasVisitedLanding', 'true');
        }
        router.push('/dashboard');
    };

    if (isCheckingLaunch || !showLanding) {
        return null;
    }

    return (
        <div className="landing-page">
            {/* 1) Logo + Title at top */}
            <div className="absolute top-8 left-40">
                <Link
                    href="/dashboard"
                    className="flex items-center gap-2 hover:opacity-80 transition"
                >
                    <div className="bg-teal-600 text-white rounded-full">
                        <FaLungs size={30} />
                    </div>
                    <div
                        style={{ background: 'rgba(255,255,255,0.1)', display: 'flex', gap: '8px' }}
                    ></div>
                    <span className="text-2xl font-bold text-white">
                        AsthmaAssist
                    </span>
                </Link>
            </div>
            {/* Background Elements */}
            <div className="background-gradient"></div>
            <div className="background-pattern"></div>
            <div
                className="mouse-light"
                style={{
                    left: mousePosition.x,
                    top: mousePosition.y,
                }}
            ></div>

            {/* Hero Section */}
            <section className="hero-section">
                <div className="hero-container">
                    <div className="hero-content">
                        <AnimatedSection delay={200}>
                            <h1 className="hero-title">
                                Analysing Human{" "}
                                <span className="gradient-text">Respiratory Infections</span>
                            </h1>
                        </AnimatedSection>

                        <AnimatedSection delay={400}>
                            <p className="hero-subtitle">
                                An interactive spatial‐analytics & ML platform to explore how air pollutants
                                drive asthma prevalence—upload your data, run models, and map your results.
                            </p>
                        </AnimatedSection>

                        <AnimatedSection delay={600}>
                            <div className="hero-buttons">
                                <button
                                    onClick={handleGetStarted}
                                    className="btn-primary"
                                >
                                    Get Started Free
                                    <svg className="btn-icon" viewBox="0 0 24 24" fill="none">
                                        <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </button>
                                <button className="btn-secondary" onClick={() =>
                                    window.open('https://github.com/PHOENIX-1040/desktop-tutorial', '_blank', 'noopener')}>

                                    Github
                                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="#000000" viewBox="0 0 256 256"><path d="M208.31,75.68A59.78,59.78,0,0,0,202.93,28,8,8,0,0,0,196,24a59.75,59.75,0,0,0-48,24H124A59.75,59.75,0,0,0,76,24a8,8,0,0,0-6.93,4,59.78,59.78,0,0,0-5.38,47.68A58.14,58.14,0,0,0,56,104v8a56.06,56.06,0,0,0,48.44,55.47A39.8,39.8,0,0,0,96,192v8H72a24,24,0,0,1-24-24A40,40,0,0,0,8,136a8,8,0,0,0,0,16,24,24,0,0,1,24,24,40,40,0,0,0,40,40H96v16a8,8,0,0,0,16,0V192a24,24,0,0,1,48,0v40a8,8,0,0,0,16,0V192a39.8,39.8,0,0,0-8.44-24.53A56.06,56.06,0,0,0,216,112v-8A58.14,58.14,0,0,0,208.31,75.68ZM200,112a40,40,0,0,1-40,40H112a40,40,0,0,1-40-40v-8a41.74,41.74,0,0,1,6.9-22.48A8,8,0,0,0,80,73.83a43.81,43.81,0,0,1,.79-33.58,43.88,43.88,0,0,1,32.32,20.06A8,8,0,0,0,119.82,64h32.35a8,8,0,0,0,6.74-3.69,43.87,43.87,0,0,1,32.32-20.06A43.81,43.81,0,0,1,192,73.83a8.09,8.09,0,0,0,1,7.65A41.72,41.72,0,0,1,200,104Z"></path></svg>
                                </button>
                            </div>
                        </AnimatedSection>
                    </div>

                    <div className="hero-visual">
                        <AnimatedSection delay={800}>
                            <div className="hero-image-container">
                                <img
                                    src="dashboard_pic2.png"
                                    alt="Document Management Interface"
                                    className="hero-image"
                                />
                                <div className="hero-image-overlay"></div>
                            </div>
                        </AnimatedSection>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section
                className="features-carousel"
                onPointerEnter={pauseCarousel}
                onPointerLeave={resumeCarousel}
                onTouchStart={pauseCarousel}
                onTouchEnd={resumeCarousel}
            >
                <div
                    className="features-carousel-track"
                    ref={carouselRef}
                    onScroll={handleScroll}
                    tabIndex={0}
                    onKeyDown={handleKeyDown}
                    onFocusCapture={pauseCarousel}
                    onBlurCapture={handleBlur}
                >
                    <section
                        id="features-dashboard"
                        className="features-section1 feature-slide"
                        aria-label="Dashboard features"
                        role="tabpanel"
                        aria-hidden={activeSlide !== 0}
                    >
                        <div className="container">
                            <ScrollRevealSection>
                                <div className="section-header">
                                    <h2 className="section-title">
                                        Dashboard
                                    </h2>
                                    <p className="section-subtitle">
                                        Map historic asthma and emissions trends. Forecast prevalence in a click.
                                    </p>
                                    <p className="section-subtitle">
                                        
                                    </p>
                                </div>
                            </ScrollRevealSection>

                            <div className="features-grid">
                                <FeatureCard
                                    icon={<svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
                                        <rect x="4" y="5" width="4" height="14" rx="1.5" stroke="currentColor" strokeWidth="2" />
                                        <rect x="10" y="3" width="4" height="18" rx="1.5" stroke="currentColor" strokeWidth="2" />
                                        <rect x="16" y="7" width="4" height="10" rx="1.5" stroke="currentColor" strokeWidth="2" />
                                        <path d="M4 9h4M10 7h4M16 11h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                    </svg>}
                                    title="1. Configure Parameters"
                                    description="Select any gas or asthma prevalance."
                                    features={[
                                        "Convinient Drop-down menu",
                                        "Consists of all gasses",
                                        "Select between any year"
                                    ]}
                                    image="set_parameters.png"
                                />

                                <FeatureCard
                                    icon={<svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
                                        <path d="M12 3c5 0 9 4 9 9s-4 9-9 9-9-4-9-9 4-9 9-9z" stroke="currentColor" strokeWidth="2" />
                                        <path d="M3.5 9h17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                        <path d="M3.5 15h17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                        <path d="M12 3c3 2.5 4.5 5.5 4.5 9S15 18.5 12 21c-3-2.5-4.5-5.5-4.5-9S9 5.5 12 3z" stroke="currentColor" strokeWidth="2" />
                                        <path d="M7 12h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                        <circle cx="12" cy="12" r="1.2" fill="currentColor" />
                                    </svg>}
                                    title="2. Visualise Data Spatially"
                                    description="See regional patterns right on the map."
                                    features={[
                                        "Get specific info upon hover",
                                        "Flexible legend for data of any range",
                                        "Wide range of colors"
                                    ]}
                                    image="dashboard_map.png"
                                />

                                <FeatureCard
                                    icon={<svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
                                        <path d="M4 17l4-4 3 3 6-6 3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        <path d="M3 5h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                        <path d="M3 21h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                        <path d="M8 5V3m8 2V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                    </svg>}
                                    title="3. Predict the Future"
                                    description="Predicts future prevalence with ML."
                                    features={[
                                        "Utilise Fine-Tuned Regression Model",
                                        "Trained on historical data from 2011-2024",
                                        "Prediction extends 2030"
                                    ]}
                                    image="prediction.png"
                                />
                            </div>
                        </div>
                    </section>

                    <section
                        id="features-data"
                        className="features-section2 feature-slide"
                        aria-label="Data features"
                        role="tabpanel"
                        aria-hidden={activeSlide !== 1}
                    >
                        <div className="container">
                            <ScrollRevealSection>
                                <div className="section-header">
                                    <h2 className="section-title">
                                        Storage
                                    </h2>
                                    <p className="section-subtitle">
                                        Keep study datasets organised, fast, and private.
                                    </p>
                                </div>
                            </ScrollRevealSection>

                            <div className="features-grid">
                                <FeatureCard
                                    icon={<svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
                                        <path
                                            d="M12 16V7m0 0-3 3m3-3 3 3m6 3a4 4 0 0 0-4-4 4 4 0 0 0-8 0 4 4 0 0 0-4 4 4 4 0 0 0 4 4h8a4 4 0 0 0 4-4z"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>}
                                    title="1. Quick Uploads"
                                    description="Drop files and start exploring right away."
                                    features={[
                                        "Sub-30 ms ingest pipeline.",
                                        "CSV and XLSX support built in.",
                                        "Drag, drop, or browse to upload."
                                    ]}
                                    image="upload.png"
                                />

                                <FeatureCard
                                    icon={<svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
                                        <rect
                                            x="3"
                                            y="4"
                                            width="18"
                                            height="16"
                                            rx="2"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                        />
                                        <path
                                            d="M3 10h18M3 16h18M9 4v16M15 4v16"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                        />
                                    </svg>}
                                    title="2. Instant Previews"
                                    description="Scan fresh rows and tidy older files."
                                    features={[
                                        "Inline row and column preview.",
                                        "One-click open or remove controls.",
                                        "Responsive even for large tables."
                                    ]}
                                    image="preview.png"
                                />

                                <FeatureCard
                                    icon={<svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
                                        <path
                                            d="M12 22c4.97-1.34 8-5.228 8-10V5l-8-3-8 3v7c0 4.772 3.03 8.66 8 10z"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                        <path
                                            d="M9 12l2 2 4-4"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>}
                                    title="3. Trusted Storage"
                                    description="Keep every dataset secure and reachable."
                                    features={[
                                        "Backed by PostgreSQL persistence.",
                                        "Workspace-only authenticated access.",
                                        "Tuned queries keep fetches quick."
                                    ]}
                                    image="storage.png"
                                />
                            </div>
                        </div>
                    </section>

                    <section
                        id="features-ml"
                        className="features-section3 feature-slide"
                        aria-label="Machine learning features"
                        role="tabpanel"
                        aria-hidden={activeSlide !== 2}
                    >
                        <div className="container">
                            <ScrollRevealSection>
                                <div className="section-header">
                                    <h2 className="section-title">
                                        Machine Learning
                                    </h2>
                                    <p className="section-subtitle">
                                        Train nine algorithms end-to-end without leaving the UI.
                                    </p>
                                </div>
                            </ScrollRevealSection>

                            <div className="features-grid">
                                <FeatureCard
                                    icon={<svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
                                        <rect
                                            x="3"
                                            y="4"
                                            width="14"
                                            height="16"
                                            rx="2"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                        />
                                        <path
                                            d="M7 8h6M7 12h6M7 16h4"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                        />
                                        <path
                                            d="m18 9 3 3-3 3"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>}
                                    title="1. Pick Your Data"
                                    description="Select a dataset and flag the target column."
                                    features={[
                                        "Browse every upload from the dataset list.",
                                        "Toggle feature columns on or off quickly.",
                                        "Confirm column availability in one glance."
                                    ]}
                                    image="select.png"
                                />

                                <FeatureCard
                                    icon={<svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
                                        <circle
                                            cx="12"
                                            cy="12"
                                            r="9"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                        />
                                        <path
                                            d="M12 3v4M12 17v4M3 12h4M17 12h4"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                        />
                                        <circle cx="12" cy="7" r="1.5" fill="currentColor" />
                                        <circle cx="7" cy="12" r="1.5" fill="currentColor" />
                                        <circle cx="12" cy="17" r="1.5" fill="currentColor" />
                                        <circle cx="17" cy="12" r="1.5" fill="currentColor" />
                                    </svg>}
                                    title="2. Switch between Models"
                                    description="Toggle across nine ready-made algorithms."
                                    features={[
                                        "Mix linear, tree and kNN options.",
                                        "Queue new runs without losing selections."
                                    ]}
                                    image="model_select.png"
                                />

                                <FeatureCard
                                    icon={<svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
                                        <rect
                                            x="3"
                                            y="3"
                                            width="18"
                                            height="14"
                                            rx="2"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                        />
                                        <polyline
                                            points="6,13 10,9 13,12 18,7"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                        <path
                                            d="M8 19h8"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                        />
                                        <path
                                            d="M10 21h4"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                        />
                                    </svg>}
                                    title="3. Read Results Fast"
                                    description="Review metrics, charts, and residuals."
                                    features={[
                                        "Check R^2, and accuracy at a glance.",
                                        "Plots and summaries inside the results.",
                                        "Surface worst residuals to handle outliers."
                                    ]}
                                    image="results.png"
                                />
                            </div>
                        </div>
                    </section>

                    <section
                        id="features-spatial"
                        className="features-section4 feature-slide"
                        aria-label="Spatial analysis features"
                        role="tabpanel"
                        aria-hidden={activeSlide !== 3}
                    >
                        <div className="container">
                            <ScrollRevealSection>
                                <div className="section-header">
                                    <h2 className="section-title">
                                        Spatial Analysis
                                    </h2>
                                    <p className="section-subtitle">
                                        Turn your datasets into Local Moran hotspot maps in minutes.
                                    </p>
                                </div>
                            </ScrollRevealSection>

                            <div className="features-grid">
                                <FeatureCard
                                    icon={<svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
                                        <rect
                                            x="3"
                                            y="4"
                                            width="18"
                                            height="16"
                                            rx="3"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                        />
                                        <path
                                            d="M7 9h6M7 13h10M7 17h4"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                        />
                                        <path
                                            d="m16 7 3-3m0 0h-3m3 0v3"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>}
                                    title="1. Set Inputs"
                                    description="Choose a dataset and the metric column."
                                    features={[
                                        "Select Dataset through the picker.",
                                        "Select the numeric feature for clustering.",
                                        "Check headers before launching analysis."
                                    ]}
                                    image="spatial_inputs.png"
                                />

                                <FeatureCard
                                    icon={<svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
                                        <path
                                            d="M12 21c5 0 9-4 9-9s-4-9-9-9-9 4-9 9 4 9 9 9z"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                        />
                                        <path
                                            d="M12 6v3m0 6v3m3-3h3m-12 0h3m6-3h3m-12 0h3"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                        />
                                        <circle cx="12" cy="12" r="2" fill="currentColor" />
                                    </svg>}
                                    title="2. Align Geography"
                                    description="Match admin levels, joins, and weights."
                                    features={[
                                        "Toggle county/state/country boundaries.",
                                        "Join keys or lat/long columns as needed.",
                                        "Choose rook/queen/kNN Spatial weights."
                                    ]}
                                    image="adm012.png"
                                />

                                <FeatureCard
                                    icon={<svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
                                        <rect
                                            x="3"
                                            y="3"
                                            width="18"
                                            height="14"
                                            rx="2"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                        />
                                        <path
                                            d="M6 14l3-3 3 2 4-4"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                        <circle cx="17.5" cy="14.5" r="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
                                        <path
                                            d="m19.5 16.5 2.5 2.5"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                        />
                                    </svg>}
                                    title="3. Map & Export"
                                    description="Run Local Moran I and capture the output."
                                    features={[
                                        "Color hotspots with Local Moran.",
                                        "Hover any region for its stats.",
                                        "Download the GeoJSON if you need it."
                                    ]}
                                    image="spatial_map.png"
                                />
                            </div>
                        </div>
                    </section>
                </div>

                <div className="features-carousel-dots" role="tablist" aria-label="Feature sections" aria-orientation="horizontal">
                    {featureSlides.map(({ id, label }, index) => (
                        <button
                            key={id}
                            type="button"
                            className={`features-carousel-dot ${activeSlide === index ? 'is-active' : ''}`}
                            aria-label={`Show ${label} features`}
                            aria-controls={`features-${id}`}
                            aria-current={activeSlide === index ? 'true' : undefined}
                            role="tab"
                            aria-selected={activeSlide === index}
                            onFocus={pauseCarousel}
                            onBlur={resumeCarousel}
                            onClick={() => {
                                pauseCarousel()
                                goToSlide(index)
                            }}
                        />
                    ))}
                </div>
            </section>

            {/* Benefits Section */}
            <section className="benefits-section">
                <div className="container">
                    <ScrollRevealSection>
                        <div className="section-header">
                            <h2 className="section-title">Why AsthmaAssist?</h2>
                        </div>
                    </ScrollRevealSection>

                    <div className="benefits-grid">
                        <BenefitItem
                            title="Faster Onboarding"
                            description="Guided walkthroughs and presets get new analysts productive within minutes."
                            delay={100}
                        />
                        <BenefitItem
                            title="Unified Data Hub"
                            description="Upload, catalog, and version research datasets without leaving the workspace."
                            delay={175}
                        />
                        <BenefitItem
                            title="Explainable ML"
                            description="Every model run ships with metrics, plots, and clear callouts for quick review."
                            delay={250}
                        />
                        <BenefitItem
                            title="Spatial Hotspot Detection"
                            description="Local Moran mapping surfaces clusters and outliers across any geography."
                            delay={325}
                        />
                        <BenefitItem
                            title="Collaboration Ready"
                            description="Share dashboards, export GeoJSON, and sync insights with teammates fast."
                            delay={400}
                        />
                        <BenefitItem
                            title="Enterprise Security"
                            description="Role-based access and encrypted storage keep sensitive health data protected."
                            delay={475}
                        />
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="cta-section">
                <div className="container">
                    <ScrollRevealSection>
                        <div className="cta-content">
                            <h2 className="cta-title">
                                Ready to Explore Asthma & Air-Pollution Links?
                            </h2>
                            <p className="cta-subtitle">
                                Sign up now and start visualizing the environmental drivers of respiratory health.
                            </p>
                            <button
                                onClick={handleGetStarted}
                                className="btn-primary btn-large"
                            >
                                Get Started Now
                                <svg className="btn-icon" viewBox="0 0 24 24" fill="none">
                                    <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                            <p className="cta-note">
                                No credit card required • Free to start • Secure & private
                            </p>
                        </div>
                    </ScrollRevealSection>
                </div>
            </section>

            {/* Footer */}
            <footer className="footer">
                <div className="container">
                    <div className="footer-content">
                        <div className="footer-brand">
                            <h3 className="footer-title">AsthmaAssist</h3>
                            <p className="footer-description">
                                Interactive spatial-ML platform for mapping and modeling asthma prevalence.
                            </p>
                        </div>
                    </div>
                </div>
            </footer>
        </div >
    );
};

export default Home




