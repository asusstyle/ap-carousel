var toNodeList = function (arrayOfNodes) {
    var fragment = document.createDocumentFragment();
    arrayOfNodes.forEach(function (item) {
        fragment.appendChild(item.cloneNode());
    });
    return fragment.childNodes;
};


function easeInOutQuad(progress) {
    progress /= 0.5;
    if (progress < 1) return 0.5 * progress * progress;
    return -0.5 * (--progress * (progress - 2) - 1);
}

/**
 * @method animate
 * @param {HTMLElement} element //The DOM element to animate.
 * @param {Object} properties // An object containing CSS properties and their target values to animate to.
 * @param {miliseconds} duration // The duration of the animation in milliseconds.
 * @param {Function} easing //A function that defines the easing algorithm. You can use one of the predefined easing functions like easeInOutQuad, or define your own.
 * @param {Function} callback // (Optional) A function to be called when the animation is complete.
 */
function animate(element, properties, duration = 1000, easing = easeInOutQuad, callback) {
    var start = performance.now();
    var initialStyles = {};
    var propertyNames = Object.keys(properties);

    propertyNames.forEach(function (propertyName) {
        initialStyles[propertyName] = element.style[propertyName];
    });

    function step(timestamp) {
        var timePassed = timestamp - start;
        var progress = timePassed / duration;

        if (progress > 1) {
            progress = 1;
        }

        var easedProgress = easing(progress);

        propertyNames.forEach(function (propertyName) {
            var initialValue = parseFloat(initialStyles[propertyName]);
            var targetValue = parseFloat(properties[propertyName]);
            var currentValue = initialValue + (targetValue - initialValue) * easedProgress;
            element.style[propertyName] = currentValue + (propertyName === 'opacity' ? '' : 'px');
        });

        if (progress < 1) {
            requestAnimationFrame(step);
        } else if (typeof callback === 'function') {
            callback();
        }
    }

    requestAnimationFrame(step);
}

class UnityCarousel extends HTMLElement {
    constructor() {
        super();

        this.slides = [...this.children];
        this.settings = this.getAttribute('settings');
        this.dataSettings = this.getAttribute('data-carousel') || {};

        this.activeBreakpoint = null;
        this.animType = null;
        this.animProp = null;
        this.breakpoints = [];
        this.breakpointSettings = [];
        this.cssTransitions = false;
        this.focussed = false;
        this.interrupted = false;
        this.hidden = 'hidden';
        this.paused = true;
        this.positionProp = null;
        this.respondTo = null;
        this.rowCount = 1;
        this.shouldClick = true;
        this.slidesCache = null;
        this.transformType = null;
        this.transitionType = null;
        this.visibilityChange = 'visibilitychange';
        this.windowWidth = 0;
        this.windowTimer = null;

        this.animating = false;
        this.dragging = false;
        this.autoPlayTimer = null;
        this.currentDirection = 0;
        this.currentLeft = null;
        this.currentSlide = 0;
        this.direction = 1;
        this.dots = null;
        this.listWidth = null;
        this.listHeight = null;
        this.loadIndex = 0;
        this.nextArrow = null;
        this.prevArrow = null;
        this.scrolling = false;
        this.slideCount = null;
        this.slideWidth = null;
        this.slideTrack = null;
        this.sliding = false;
        this.slideOffset = 0;
        this.swipeLeft = null;
        this.swiping = false;
        this.list = null;
        this.touchObject = {};
        this.transformsEnabled = false;
        this.unslicked = false;
    }

    connectedCallback() {
        this.defaults = {
            accessibility: true,
            adaptiveHeight: false,
            appendArrows: this,
            appendDots: this,
            arrows: true,
            asNavFor: null,
            autoplay: false,
            autoplaySpeed: 3000,
            centerMode: false,
            centerPadding: '50px',
            cssEase: 'ease',
            customPaging: function (slider, i) {
                const btn = this.createElement('button', null, { type: 'button' });
                btn.innerText = i + 1;
                return btn;
            },
            dots: true,
            dotsClass: 'uc-carousel-dots',
            draggable: true,
            easing: 'linear',
            edgeFriction: 0.35,
            fade: false,
            focusOnSelect: false,
            focusOnChange: false,
            infinite: true,
            initialSlide: 0,
            lazyLoad: 'ondemand',
            mobileFirst: false,
            pauseOnHover: true,
            pauseOnFocus: true,
            pauseOnDotsHover: false,
            respondTo: 'window',
            responsive: null,
            rows: 1,
            rtl: false,
            slide: '',
            slidesPerRow: 1,
            slidesToShow: 1,
            slidesToScroll: 1,
            speed: 500,
            swipe: true,
            swipeToSlide: false,
            touchMove: true,
            touchThreshold: 5,
            useCSS: true,
            useTransform: true,
            variableWidth: false,
            vertical: false,
            verticalSwiping: false,
            waitForAnimate: true,
            zIndex: 1000
        };

        this.options = { ...this.defaults, ...this.settings, ...this.dataSettings };
        this.currentSlide = this.options.initialSlide;
        this.originalSettings = this.options;

        if (typeof document.mozHidden !== 'undefined') {
            this.hidden = 'mozHidden';
            this.visibilityChange = 'mozvisibilitychange';
        } else if (typeof document.webkitHidden !== 'undefined') {
            this.hidden = 'webkitHidden';
            this.visibilityChange = 'webkitvisibilitychange';
        }

        // A simple way to check for HTML strings
        // Strict HTML recognition (must start with <)
        // Extracted from jQuery v1.11 source
        this.htmlExpr = /^(?:\s*(<[\w\W]+>)[^>]*)$/;

        this.init();
    }
    
    init = (creation) => {
        const _ = this;

        if (!_.classList.contains('uc-carousel-initialized')) {
            _.classList.add('uc-carousel-initialized');

            // TODO:
            // _.buildRows();

            _.buildOut();
            _.setProps();
            _.startLoad();
            _.loadSlider();
            _.initializeEvents();            
            _.updateArrows();
            _.updateDots();
            _.checkResponsive(true);
            _.focusHandler();
        }

        if (creation) {
            const triggerInit = new Event('init', {_});
            _.dispatchEvent(triggerInit);
        }

        //TODO: Only Pending function apart from `animation`
        // if (_.options.accessibility === true) {
        //     _.initADA();
        // }

        if (_.options.autoplay) {
            _.paused = false;
            _.autoPlay();
        }
    }

    focusHandler = () => {
        const _ = this;

        function triggerFocusBlur(event) {
            event.stopImmediatePropagation();

            const sf = this;

            setTimeout(() => {
                if (_.options.pauseOnFocus) {
                    _.focussed = sf.matches(':focus');
                    _.autoPlay();
                }
            }, 0);
        }

        _.removeEventListener('focus', triggerFocusBlur);
        _.removeEventListener('blur', triggerFocusBlur);
        _.addEventListener('focus', triggerFocusBlur);
        _.addEventListener('blur', triggerFocusBlur);
    }

    interrupt = (toggle) => {
        const _ = this;

        if (!toggle) {
            _.autoPlay();
        }
        _.interrupted = toggle;
    }

    unslick = (fromBreakpoint) => {
        const _ = this;
        
        const triggerUnslick = new Event('unslick', [_, fromBreakpoint]);
        _.dispatchEvent(triggerUnslick);
        _.destroy();
    }

    refresh = (initializing) => {
        const _ = this;
        let currentSlide, lastVisibleIndex;

        lastVisibleIndex = _.slideCount - _.options.slidesToShow;

        // in non-infinite sliders, we don't want to go past the
        // last visible index.
        if (!_.options.infinite && (_.currentSlide > lastVisibleIndex)) {
            _.currentSlide = lastVisibleIndex;
        }

        // if less slides than to show, go to start.
        if (_.slideCount <= _.options.slidesToShow) {
            _.currentSlide = 0;
        }

        currentSlide = _.currentSlide;

        _.destroy(true);

        Object.assign(_, _.initials, { currentSlide: currentSlide });
        _.init();

        if (!initializing) {
            _.changeSlide({
                data: {
                    message: 'index',
                    index: currentSlide
                }
            }, false);
        }
    }

    destroy = (refresh) => {
        const _ = this;

        _.autoPlayClear();
        _.touchObject = {};

        // TODO: This one is also pending :)
        // _.cleanUpEvents();

        // TODO: detach() function is also :)
        // $('.slick-cloned', _.$slider).detach();

        if (_.dots) {
            _.dots.remove();
        }

        if (_.prevArrow && _.prevArrow.length) {
            _.prevArrow.classList.remove('slick-disabled,slick-arrow,slick-hidden');
            _.prevArrow.removeAttribute('aria-hidden');
            _.prevArrow.removeAttribute('aria-disabled');
            _.prevArrow.removeAttribute('tabindex');
            _.prevArrow.style.display = '';

            if (_.htmlExpr.test(_.options.prevArrow)) {
                _.prevArrow.remove();
            }
        }

        if (_.nextArrow && _.nextArrow.length) {
            _.nextArrow.classList.remove('slick-disabled,slick-arrow,slick-hidden');
            _.nextArrow.removeAttribute('aria-hidden');
            _.nextArrow.removeAttribute('aria-disabled');
            _.nextArrow.removeAttribute('tabindex');

            if (_.htmlExpr.test(_.options.nextArrow)) {
                _.nextArrow.remove();
            }
        }

        if (_.slides) {
            _.slides.forEach(item => {
                item.classList.remove('slick-slide,slick-active,slick-center,slick-visible,slick-current');
                item.removeAttribute('aria-hidden');
                item.removeAttribute('data-slick-index');

                item.style = item.dataset.originalStyling;
            });

            // TODO: detach() function is also :)
            // _.$slideTrack.children(this.options.slide).detach();
            // _.$slideTrack.detach();
            // _.$list.detach();

            _.append(_.slides);
        }

        _.cleanUpRows();

        _.classList.removeClass.remove('slick-slider,slick-initialized,slick-dotted');

        _.unslicked = true;

        if (!refresh) {
            const triggerDestroy = new Event('destroy', [_]);
            _.dispatchEvent(triggerDestroy);
        }
    }

    cleanUpRows = () => {
        const _ = this;
        let originalSlides;

        if (_.options.rows > 0) {
            originalSlides = _.slides.childNodes;
            originalSlides.forEach(item => {
                item.removeAttribute('style');
            });

            for (const obj in originalSlides) {
                originalSlides.remove(obj);
            }
            _.appendChild(originalSlides);
        }
    }

    checkResponsive = (initial, forceUpdate) => {
        const _ = this;
        let breakpoint, targetBreakpoint, respondToWidth, triggerBreakpoint = false;
        const sliderWidth = _.clientWidth;
        const windowWidth = window.innerWidth;

        if (_.respondTo === 'window') {
            respondToWidth = windowWidth;
        } else if (_.respondTo === 'slider') {
            respondToWidth = sliderWidth;
        } else if (_.respondTo === 'min') {
            respondToWidth = Math.min(windowWidth, sliderWidth);
        }

        if (_.options.responsive && _.options.responsive.length && _.options.responsive !== null) {
            targetBreakpoint = null;

            for (breakpoint in _.breakpoints) {
                if (_.breakpoints.hasOwnProperty(breakpoint)) {
                    if (_.originalSettings.mobileFirst === false) {
                        if (respondToWidth < _.breakpoints[breakpoint]) {
                            targetBreakpoint = _.breakpoints[breakpoint];
                        }
                    } else {
                        if (respondToWidth > _.breakpoints[breakpoint]) {
                            targetBreakpoint = _.breakpoints[breakpoint];
                        }
                    }
                }
            }

            if (targetBreakpoint !== null) {
                if (_.activeBreakpoint !== null) {
                    if (targetBreakpoint !== _.activeBreakpoint || forceUpdate) {
                        _.activeBreakpoint = targetBreakpoint;

                        if (_.breakpointSettings[targetBreakpoint] === 'unslick') {
                            _.unslick(targetBreakpoint);
                        } else {
                            _.options = Object.assign(_.originalSettings, _.breakpointSettings[targetBreakpoint]);
                            
                            if (initial === true) {
                                _.currentSlide = _.options.initialSlide;
                            }
                            _.refresh(initial);
                        }
                        triggerBreakpoint = targetBreakpoint;
                    }
                } else {
                    _.activeBreakpoint = targetBreakpoint;
                    if (_.breakpointSettings[targetBreakpoint] === 'unslick') {
                        _.unslick(targetBreakpoint);
                    } else {
                        _.options = Object.assign(_.originalSettings, _.breakpointSettings[targetBreakpoint]);
                        if (initial === true) {
                            _.currentSlide = _.options.initialSlide;
                        }
                        _.refresh(initial);
                    }
                    triggerBreakpoint = targetBreakpoint;
                }
            } else {
                if (_.activeBreakpoint !== null) {
                    _.activeBreakpoint = null;
                    _.options = _.originalSettings;
                    if (initial === true) {
                        _.currentSlide = _.options.initialSlide;
                    }
                    _.refresh(initial);
                    triggerBreakpoint = targetBreakpoint;
                }
            }

            // only trigger breakpoints during an actual break. not on initialize.
            if (!initial && triggerBreakpoint !== false) {
                const trgrBreakpoint = new Event('breakpoint', [_, triggerBreakpoint]);
                _.dispatchEvent(trgrBreakpoint);
            }
        }
    }

    postSlide = (index) => {
        const _ = this;

        if (!_.unslicked) {
            const triggerAfterChange = new Event('afterChange', [_, index]);
            _.dispatchEvent(triggerAfterChange);

            _.animating = false;

            if (_.slideCount > _.options.slidesToShow) {
                _.setPosition();
            }
            _.swipeLeft = null;

            if (_.options.autoplay) {
                _.autoPlay();
            }

            if (_.options.accessibility === true) {
                //TODO:
                // _.initADA();

                if (_.options.focusOnChange) {
                    const currentSlide = _.slides.querySelector(_.currentSlide);
                    currentSlide.setAttribute('tabindex', 0);
                    currentSlide.focus();
                }
            }
        }
    }

    changeSlide = (event, dontAnimate) => {
        const _ = this;
        let target = event.currentTarget,
            indexOffset, slideOffset, unevenOffset;

        // If target is a link, prevent default action.
        if (target.tagName.toLowerCase() === 'a') {
            event.preventDefault();
        }

        // If target is not the <li> element (ie: a child), find the <li>.
        if (!target.tagName.toLowerCase() === 'li') {
            target = target.closest('li');
        }

        unevenOffset = (_.slideCount % _.options.slidesToScroll !== 0);
        indexOffset = unevenOffset ? 0 : (_.slideCount - _.currentSlide) % _.options.slidesToScroll;

        switch (event.data.message) {
            case 'previous':
                slideOffset = indexOffset === 0 ? _.options.slidesToScroll : _.options.slidesToShow - indexOffset;
                if (_.slideCount > _.options.slidesToShow) {
                    _.slideHandler(_.currentSlide - slideOffset, false, dontAnimate);
                }
                break;

            case 'next':
                slideOffset = indexOffset === 0 ? _.options.slidesToScroll : indexOffset;
                if (_.slideCount > _.options.slidesToShow) {
                    _.slideHandler(_.currentSlide + slideOffset, false, dontAnimate);
                }
                break;

            case 'index':
                // TODO: update `index` value from below commentted line
                const index = event.data.index === 0 ? 0 : event.data.index;
                // const index = event.data.index === 0 ? 0 : event.data.index || target.index() * _.options.slidesToScroll;

                _.slideHandler(_.checkNavigable(index), false, dontAnimate);
                for (const child of target.children) {
                    child.focus();
                }
                break;

            default:
                return;
        }
    }

    checkNavigable = (index) => {
        const _ = this;
        let navigables, prevNavigable;

        navigables = _.getNavigableIndexes();
        prevNavigable = 0;
        if (index > navigables[navigables.length - 1]) {
            index = navigables[navigables.length - 1];
        } else {
            for (var n in navigables) {
                if (index < navigables[n]) {
                    index = prevNavigable;
                    break;
                }
                prevNavigable = navigables[n];
            }
        }
        return index;
    }

    getNavigableIndexes = () => {
        const _ = this;
        let breakPoint = 0,
            counter = 0,
            indexes = [],
            max;

        if (_.options.infinite === false) {
            max = _.slideCount;
        } else {
            breakPoint = _.options.slidesToScroll * -1;
            counter = _.options.slidesToScroll * -1;
            max = _.slideCount * 2;
        }

        while (breakPoint < max) {
            indexes.push(breakPoint);
            breakPoint = counter + _.options.slidesToScroll;
            counter += _.options.slidesToScroll <= _.options.slidesToShow ? _.options.slidesToScroll : _.options.slidesToShow;
        }

        return indexes;
    }

    slideHandler = (index, sync, dontAnimate) => {
        const _ = this;
        let targetSlide, animSlide, oldSlide, slideLeft, targetLeft = null, navTarget;

        sync = sync || false;

        if (_.animating === true && _.options.waitForAnimate === true) {
            return;
        }

        if (_.options.fade === true && _.currentSlide === index) {
            return;
        }

        if (sync === false) {
            _.asNavFor(index);
        }

        targetSlide = index;
        targetLeft = _.getLeft(targetSlide);
        slideLeft = _.getLeft(_.currentSlide);

        _.currentLeft = _.swipeLeft === null ? slideLeft : _.swipeLeft;

        if (_.options.infinite === false && _.options.centerMode === false && (index < 0 || index > _.getDotCount() * _.options.slidesToScroll)) {
            if (_.options.fade === false) {
                targetSlide = _.currentSlide;
                if (dontAnimate !== true && _.slideCount > _.options.slidesToShow) {
                    _.animateSlide(slideLeft, () => {
                        _.postSlide(targetSlide);
                    });
                } else {
                    _.postSlide(targetSlide);
                }
            }
            return;
        } else if (_.options.infinite === false && _.options.centerMode === true && (index < 0 || index > (_.slideCount - _.options.slidesToScroll))) {
            if (_.options.fade === false) {
                targetSlide = _.currentSlide;
                if (dontAnimate !== true && _.slideCount > _.options.slidesToShow) {
                    _.animateSlide(slideLeft, () => {
                        _.postSlide(targetSlide);
                    });
                } else {
                    _.postSlide(targetSlide);
                }
            }
            return;
        }

        if (_.options.autoplay) {
            clearInterval(_.autoPlayTimer);
        }

        if (targetSlide < 0) {
            if (_.slideCount % _.options.slidesToScroll !== 0) {
                animSlide = _.slideCount - (_.slideCount % _.options.slidesToScroll);
            } else {
                animSlide = _.slideCount + targetSlide;
            }
        } else if (targetSlide >= _.slideCount) {
            if (_.slideCount % _.options.slidesToScroll !== 0) {
                animSlide = 0;
            } else {
                animSlide = targetSlide - _.slideCount;
            }
        } else {
            animSlide = targetSlide;
        }

        _.animating = true;

        const triggerBeforeChange = new Event('beforeChange', [_, _.currentSlide, animSlide]);
        _.dispatchEvent(triggerBeforeChange);

        oldSlide = _.currentSlide;
        _.currentSlide = animSlide;

        _.setSlideClasses(_.currentSlide);

        if (_.options.asNavFor) {
            navTarget = _.getNavTarget();
            // TODO:
            // navTarget = navTarget.slick('getSlick');
            if (navTarget.slideCount <= navTarget.options.slidesToShow) {
                navTarget.setSlideClasses(_.currentSlide);
            }
        }

        _.updateDots();
        _.updateArrows();

        if (_.options.fade === true) {
            if (dontAnimate !== true) {
                _.fadeSlideOut(oldSlide);

                _.fadeSlide(animSlide, () => {
                    _.postSlide(animSlide);
                });

            } else {
                _.postSlide(animSlide);
            }
            _.animateHeight();
            return;
        }

        if (dontAnimate !== true && _.slideCount > _.options.slidesToShow) {
            _.animateSlide(targetLeft, () => {
                _.postSlide(animSlide);
            });
        } else {
            _.postSlide(animSlide);
        }
    }

    animateHeight = () => {
        const _ = this;

        if (_.options.slidesToShow === 1 && _.options.adaptiveHeight === true && _.options.vertical === false) {
            const targetHeight = _.slides[_.currentSlide].clientHeight;

            animate(_.list, { height: `${targetHeight}px` }, _.options.speed);
        }
    }

    disableTransition = (slide) => {
        const _ = this,
            transition = {};

        transition[_.transitionType] = '';

        if (_.options.fade === false) {
            _.slideTrack.style = { ...transition };
        } else {
            _.slides[slide].style = { ...transition };
        }
    }

    fadeSlide = (slideIndex, callback) => {
        const _ = this;

        if (_.cssTransitions === false) {
            _.slides[slideIndex].style = {
                zIndex: _.options.zIndex
            };
            animate(_.slides[slideIndex], { opacity: 1 }, _.options.speed, _.options.easing, callback);
        } else {
            _.applyTransition(slideIndex);

            _.slides[slideIndex].style = {
                opacity: 1,
                zIndex: _.options.zIndex
            };

            if (callback) {
                setTimeout(() => {
                    _.disableTransition(slideIndex);

                    callback.call();
                }, _.options.speed);
            }
        }
    }

    fadeSlideOut = (slideIndex) => {
        const _ = this;

        if (_.cssTransitions === false) {
            animate(_.slides[slideIndex], { opacity: 0, zIndex: _.options.zIndex - 2 }, _.options.speed, _.options.easing);
        } else {
            _.applyTransition(slideIndex);

            _.slides[slideIndex].style = {
                opacity: 0,
                zIndex: _.options.zIndex - 2
            };
        }
    }

    applyTransition = (slide) => {
        const _ = this,
            transition = {};

        if (_.options.fade === false) {
            transition[_.transitionType] = _.transformType + ' ' + _.options.speed + 'ms ' + _.options.cssEase;
        } else {
            transition[_.transitionType] = 'opacity ' + _.options.speed + 'ms ' + _.options.cssEase;
        }

        if (_.options.fade === false) {
            _.slideTrack.style = { ...transition };
        } else {
            _.slides[slide].style = { ...transition };
        }
    }

    animateSlide = (targetLeft, callback) => {
        const _ = this,
            animProps = {};

        _.animateHeight();

        if (_.options.rtl === true && _.options.vertical === false) {
            targetLeft = -targetLeft;
        }
        if (_.transformsEnabled === false) {
            if (_.options.vertical === false) {
                animate(_.slideTrack, { left: targetLeft }, _.options.speed, _.options.easing, callback);
            } else {
                animate(_.slideTrack, { top: targetLeft }, _.options.speed, _.options.easing, callback);
            }

        } else {
            if (_.cssTransitions === false) {
                if (_.options.rtl === true) {
                    _.currentLeft = -(_.currentLeft);
                }
                // TODO:
                // $({ animStart: _.currentLeft }).animate({ animStart: targetLeft}, {
                //     duration: _.options.speed,
                //     easing: _.options.easing,
                //     step: function (now) {
                //         now = Math.ceil(now);
                //         if (_.options.vertical === false) {
                //             animProps[_.animType] = 'translate(' + now + 'px, 0px)';
                //             _.$slideTrack.css(animProps);
                //         } else {
                //             animProps[_.animType] = 'translate(0px,' + now + 'px)';
                //             _.$slideTrack.css(animProps);
                //         }
                //     },
                //     complete: function () {
                //         if (callback) {
                //             callback.call();
                //         }
                //     }
                // });
            } else {
                _.applyTransition();
                targetLeft = Math.ceil(targetLeft);

                if (_.options.vertical === false) {
                    animProps[_.animType] = 'translate3d(' + targetLeft + 'px, 0px, 0px)';
                } else {
                    animProps[_.animType] = 'translate3d(0px,' + targetLeft + 'px, 0px)';
                }
                _.slideTrack.style[_.animType] = animProps[_.animType];
                // _.slideTrack.style = animProps;

                if (callback) {
                    setTimeout(function () {
                        _.disableTransition();
                        callback.call();
                    }, _.options.speed);
                }
            }
        }
    }

    keyHandler = (event) => {
        const _ = this;

        //Dont slide if the cursor is inside the form fields and arrow keys are pressed
        if (!event.target.tagName.match('TEXTAREA|INPUT|SELECT')) {
            if (event.keyCode === 37 && _.options.accessibility === true) {
                _.changeSlide({
                    data: {
                        message: _.options.rtl === true ? 'next' : 'previous'
                    }
                });
            } else if (event.keyCode === 39 && _.options.accessibility === true) {
                _.changeSlide({
                    data: {
                        message: _.options.rtl === true ? 'previous' : 'next'
                    }
                });
            }
        }
    }

    selectHandler = (event) => {
        const _ = this;
        const targetElement = event.target.classList.contains('uc-carousel-slide') ? event.target : event.target.closest('.uc-carousel-slide');
        const index = parseInt(targetElement.getAttribute('data-slide-index'));

        if (!index) index = 0;

        if (_.slideCount <= _.options.slidesToShow) {
            _.slideHandler(index, false, true);
            return;
        }
        _.slideHandler(index);
    }

    clickHandler = (event) => {
        const _ = this;

        if (_.shouldClick === false) {
            event.stopImmediatePropagation();
            event.stopPropagation();
            event.preventDefault();
        }
    }

    swipeHandler = (event) => {
        const _ = this;

        if ((_.options.swipe === false) || ('ontouchend' in document && _.options.swipe === false)) {
            return;
        } else if (_.options.draggable === false && event.type.indexOf('mouse') !== -1) {
            return;
        }

        _.touchObject.fingerCount = event.originalEvent && event.originalEvent.touches !== undefined ? event.originalEvent.touches.length : 1;

        _.touchObject.minSwipe = _.listWidth / _.options.touchThreshold;

        if (_.options.verticalSwiping === true) {
            _.touchObject.minSwipe = _.listHeight / _.options
                .touchThreshold;
        }

        switch (event.data.action) {
            case 'start':
                _.swipeStart(event);
                break;

            case 'move':
                _.swipeMove(event);
                break;

            case 'end':
                _.swipeEnd(event);
                break;
        }
    }

    getSlideCount = () => {
        const _ = this;
        let slidesTraversed, swipedSlide, centerOffset;

        centerOffset = _.options.centerMode === true ? _.slideWidth * Math.floor(_.options.slidesToShow / 2) : 0;

        if (_.options.swipeToSlide === true) {
            _.$slideTrack.find('.slick-slide').each(function (index, slide) {
                if (slide.offsetLeft - centerOffset + ($(slide).outerWidth() / 2) > (_.swipeLeft * -1)) {
                    swipedSlide = slide;
                    return false;
                }
            });

            slidesTraversed = Math.abs($(swipedSlide).attr('data-slick-index') - _.currentSlide) || 1;

            return slidesTraversed;

        } else {
            return _.options.slidesToScroll;
        }

    }

    swipeDirection = () => {
        let xDist, yDist, r, swipeAngle, _ = this;

        xDist = _.touchObject.startX - _.touchObject.curX;
        yDist = _.touchObject.startY - _.touchObject.curY;
        r = Math.atan2(yDist, xDist);

        swipeAngle = Math.round(r * 180 / Math.PI);
        if (swipeAngle < 0) {
            swipeAngle = 360 - Math.abs(swipeAngle);
        }

        if ((swipeAngle <= 45) && (swipeAngle >= 0)) {
            return (_.options.rtl === false ? 'left' : 'right');
        }
        if ((swipeAngle <= 360) && (swipeAngle >= 315)) {
            return (_.options.rtl === false ? 'left' : 'right');
        }
        if ((swipeAngle >= 135) && (swipeAngle <= 225)) {
            return (_.options.rtl === false ? 'right' : 'left');
        }
        if (_.options.verticalSwiping === true) {
            if ((swipeAngle >= 35) && (swipeAngle <= 135)) {
                return 'down';
            } else {
                return 'up';
            }
        }
        return 'vertical';
    }

    swipeEnd = (event) => {
        const _ = this;
        let slideCount, direction;

        _.dragging = false;
        _.swiping = false;

        if (_.scrolling) {
            _.scrolling = false;
            return false;
        }

        _.interrupted = false;
        _.shouldClick = (_.touchObject.swipeLength > 10) ? false : true;

        if (_.touchObject.curX === undefined) {
            return false;
        }
        if (_.touchObject.edgeHit === true) {
            const triggerEdge = new Event('edge', [_, _.swipeDirection()]);
            _.slider.dispatchEvent(triggerEdge);
        }
        if (_.touchObject.swipeLength >= _.touchObject.minSwipe) {
            direction = _.swipeDirection();

            switch (direction) {
                case 'left':
                case 'down':
                    slideCount = _.options.swipeToSlide ? _.checkNavigable(_.currentSlide + _.getSlideCount()) : _.currentSlide + _.getSlideCount();

                    _.currentDirection = 0;

                    break;

                case 'right':
                case 'up':
                    slideCount = _.options.swipeToSlide ? _.checkNavigable(_.currentSlide - _.getSlideCount()) : _.currentSlide - _.getSlideCount();

                    _.currentDirection = 1;

                    break;

                default:
            }
            if (direction != 'vertical') {
                _.slideHandler(slideCount);
                _.touchObject = {};
                _.$slider.trigger('swipe', [_, direction]);
            }
        } else {
            if (_.touchObject.startX !== _.touchObject.curX) {
                _.slideHandler(_.currentSlide);
                _.touchObject = {};
            }
        }
    }

    swipeMove = (event) => {
        const _ = this,
            edgeWasHit = false;
        let curLeft, swipeDirection, swipeLength, positionOffset, touches, verticalSwipeLength;

        touches = event.originalEvent !== undefined ? event.originalEvent.touches : null;

        if (!_.dragging || _.scrolling || touches && touches.length !== 1) {
            return false;
        }

        curLeft = _.getLeft(_.currentSlide);

        _.touchObject.curX = touches !== undefined ? touches[0].pageX : event.clientX;
        _.touchObject.curY = touches !== undefined ? touches[0].pageY : event.clientY;

        _.touchObject.swipeLength = Math.round(Math.sqrt(Math.pow(_.touchObject.curX - _.touchObject.startX, 2)));

        verticalSwipeLength = Math.round(Math.sqrt(Math.pow(_.touchObject.curY - _.touchObject.startY, 2)));

        if (!_.options.verticalSwiping && !_.swiping && verticalSwipeLength > 4) {
            _.scrolling = true;
            return false;
        }

        if (_.options.verticalSwiping === true) {
            _.touchObject.swipeLength = verticalSwipeLength;
        }

        swipeDirection = _.swipeDirection();

        if (event.originalEvent !== undefined && _.touchObject.swipeLength > 4) {
            _.swiping = true;
            event.preventDefault();
        }

        positionOffset = (_.options.rtl === false ? 1 : -1) * (_.touchObject.curX > _.touchObject.startX ? 1 : -1);
        if (_.options.verticalSwiping === true) {
            positionOffset = _.touchObject.curY > _.touchObject.startY ? 1 : -1;
        }


        swipeLength = _.touchObject.swipeLength;

        _.touchObject.edgeHit = false;

        if (_.options.infinite === false) {
            if ((_.currentSlide === 0 && swipeDirection === 'right') || (_.currentSlide >= _.getDotCount() && swipeDirection === 'left')) {
                swipeLength = _.touchObject.swipeLength * _.options.edgeFriction;
                _.touchObject.edgeHit = true;
            }
        }

        if (_.options.vertical === false) {
            _.swipeLeft = curLeft + swipeLength * positionOffset;
        } else {
            _.swipeLeft = curLeft + (swipeLength * (_.list.clientHeight / _.listWidth)) * positionOffset;
        }
        if (_.options.verticalSwiping === true) {
            _.swipeLeft = curLeft + swipeLength * positionOffset;
        }

        if (_.options.fade === true || _.options.touchMove === false) {
            return false;
        }

        if (_.animating === true) {
            _.swipeLeft = null;
            return false;
        }

        _.setCSS(_.swipeLeft);
    }

    swipeStart = (event) => {
        const _ = this;
        let touches;

        _.interrupted = true;

        if (_.touchObject.fingerCount !== 1 || _.slideCount <= _.options.slidesToShow) {
            _.touchObject = {};
            return false;
        }

        if (event.originalEvent !== undefined && event.originalEvent.touches !== undefined) {
            touches = event.originalEvent.touches[0];
        }

        _.touchObject.startX = _.touchObject.curX = touches !== undefined ? touches.pageX : event.clientX;
        _.touchObject.startY = _.touchObject.curY = touches !== undefined ? touches.pageY : event.clientY;

        _.dragging = true;
    }

    initArrowEvents = () => {
        const _ = this;

        if (_.options.arrows === true && _.slideCount > _.options.slidesToShow) {
            _.prevArrow.removeEventListener('click', _.changeSlide);
            _.prevArrow.addEventListener('click', (e) => {
                e.data = { message: 'previous' };
                _.changeSlide(e);
            });

            _.nextArrow.removeEventListener('click', _.changeSlide);
            _.nextArrow.addEventListener('click', (e) => {
                e.data = { message: 'next' };
                _.changeSlide(e);
            });

            if (_.options.accessibility === true) {
                _.prevArrow.addEventListener('keydown', _.keyHandler);
                _.nextArrow.addEventListener('keydown', _.keyHandler);
            }
        }
    }

    initDotEvents = () => {
        const _ = this;

        if (_.options.dots === true && _.slideCount > _.options.slidesToShow) {
            _.dots.addEventListener('click', (e) => {
                if (e.currentTarget.tagName.toLowerCase() === 'li') {
                    e.data = { message: 'index' };
                    _.changeSlide(e);
                }
            });

            if (_.options.accessibility === true) {
                _.dots.addEventListener('keydown', _.keyHandler);
            }
        }

        if (_.options.dots === true && _.options.pauseOnDotsHover === true && _.slideCount > _.options.slidesToShow) {
            
            _.dots.addEventListener('mouseenter', (e) => {
                if (e.currentTarget.tagName.toLowerCase() === 'li') {
                    _.interrupt()
                }
            }, true);
            _.dots.addEventListener('mouseleave', (e) => {
                if (e.currentTarget.tagName.toLowerCase() === 'li') {
                    _.interrupt();
                }
            }, false);
        }
    }

    initSlideEvents = () => {
        const _ = this;

        if (_.options.pauseOnHover) {
            _.list.addEventListener('mouseenter', _.interrupt, true);
            _.list.addEventListener('mouseleave', _.interrupt, false);
        }
    }

    visibility = () => {
        const _ = this;

        if (_.options.autoplay) {
            if (document[_.hidden]) {
                _.interrupted = true;
            } else {
                _.interrupted = false;
            }
        }
    }

    initializeEvents = () => {
        const _ = this;

        _.initArrowEvents();

        _.initDotEvents();
        _.initSlideEvents();

        _.list.addEventListener('touchstart', (e) => {
            e.data = { action: 'start' };
            _.swipeHandler(e);
        });
        _.list.addEventListener('mousedown', (e) => {
            e.data = { action: 'start' };
            _.swipeHandler(e);
        });

        _.list.addEventListener('touchmove', (e) => {
            e.data = { action: 'move' };
            _.swipeHandler(e);
        });
        _.list.addEventListener('mousemove', (e) => {
            e.data = { action: 'move' };
            _.swipeHandler(e);
        });

        _.list.addEventListener('touchend', (e) => {
            e.data = { action: 'end' };
            _.swipeHandler(e);
        });
        _.list.addEventListener('mouseup', (e) => {
            e.data = { action: 'end' };
            _.swipeHandler(e);
        });

        _.list.addEventListener('touchcancel', (e) => {
            e.data = { action: 'end' };
            _.swipeHandler(e);
        });
        _.list.addEventListener('mouseleave', (e) => {
            e.data = { action: 'end' };
            _.swipeHandler(e);
        });

        _.list.addEventListener('click', _.clickHandler);

        // TODO:
        // $(document).on(_.visibilityChange, $.proxy(_.visibility, _));

        if (_.options.accessibility === true) {
            _.list.addEventListener('keydown', _.keyHandler);
        }

        if (_.options.focusOnSelect === true) {
            _.slideTrack.children.forEach(item => {
                item.addEventListener('click', _.selectHandler);
            });
        }

        // TODO:
        // $(window).on('orientationchange.slick.slick-' + _.instanceUid, $.proxy(_.orientationChange, _));
        // $(window).on('resize.slick.slick-' + _.instanceUid, $.proxy(_.resize, _));
        // $('[draggable!=true]', _.$slideTrack).on('dragstart', _.preventDefault);
        // $(window).on('load.slick.slick-' + _.instanceUid, _.setPosition);
        // $(_.setPosition);
    }

    buildRows = () => {
        const _ = this;
        let a, b, c, newSlides, numOfSlides, originalSlides, slidesPerSection;

        newSlides = document.createDocumentFragment();
        originalSlides = _.slides;

        if (_.options.rows > 0) {
            slidesPerSection = _.options.slidesPerRow * _.options.rows;
            numOfSlides = Math.ceil(originalSlides.length / slidesPerSection);

            for (a = 0; a < numOfSlides; a++) {
                const slide = this.createElement('div');

                for (b = 0; b < _.options.rows; b++) {
                    const row = this.createElement('div');

                    for (c = 0; c < _.options.slidesPerRow; c++) {
                        const target = (a * slidesPerSection + ((b * _.options.slidesPerRow) + c));

                        originalSlides.forEach(item => {
                            if (item[target]) {
                                row.appendChild(item[target]);
                            }
                        });
                    }
                    slide.appendChild(row);
                }
                newSlides.appendChild(slide);
            }

            const childNodes = _.slides.childNodes;
            for (const obj in childNodes) {
                childNodes.remove(obj);
            }
            _.slides.appendChild(newSlides);

            _.querySelectorAll('.uc-carousel-slide').forEach(item => {
                item.style = {
                    'width': (100 / _.options.slidesPerRow) + '%',
                    'display': 'inline-block'
                }
            });
        }
    }

    progressiveLazyLoad = (tryCount) => {
        tryCount = tryCount || 1;

        const _ = this;
        let imgsToLoad = this.querySelectorAll('img[data-lazy]'),
            image,
            imageSource,
            imageSrcSet,
            imageSizes,
            imageToLoad;

        if (imgsToLoad.length) {
            image = imgsToLoad.firstElementChild;
            imageSource = image.getAttribute('data-lazy');
            imageSrcSet = image.getAttribute('data-srcset');
            imageSizes = image.getAttribute('data-sizes') || _.getAttribute('data-sizes');
            imageToLoad = this.createElement('img');

            imageToLoad.onload = () => {
                if (imageSrcSet) {
                    image.setAttribute('srcset', imageSrcSet);

                    if (imageSizes) {
                        image.setAttribute('sizes', imageSizes);
                    }
                }

                image.setAttribute('src', imageSource);
                image.removeAttribute('data-lazy');
                image.removeAttribute('data-srcset');
                image.removeAttribute('data-sizes');
                image.classList.remove('uc-carousel-loading');

                if (_.options.adaptiveHeight === true) {
                    _.setPosition();
                }
                const triggerLazyLoaded = new Event('lazyLoaded', [_, image, imageSource]);
                _.dispatchEvent(triggerLazyLoaded);
                _.progressiveLazyLoad();
            };

            imageToLoad.onerror = () => {
                if (tryCount < 3) {
                    /**
                     * try to load the image 3 times,
                     * leave a slight delay so we don't get
                     * servers blocking the request.
                     */
                    setTimeout(() => {
                        _.progressiveLazyLoad(tryCount + 1);
                    }, 500);

                } else {
                    image.removeAttribute('data-lazy');
                    image.classList.remove('uc-carousel-loading');
                    image.classList.add('uc-carousel-lazyload-error');

                    const triggerLazyLoadError = new Event('lazyLoadError', [_, image, imageSource]);
                    _.dispatchEvent(triggerLazyLoadError);
                    _.progressiveLazyLoad();
                }
            }
            imageToLoad.src = imageSource;

        } else {
            const triggerAllImagesLoaded = new Event('allImagesLoaded', [_]);
            _.dispatchEvent(triggerAllImagesLoaded);
        }
    }

    lazyLoad = () => {
        const _ = this;
        let loadRange, cloneRange, rangeStart, rangeEnd;

        function loadImages(imagesScope) {
            imagesScope.querySelectorAll('img[data-lazy]').forEach(item => {
                const image = item,
                    imageSource = item.getAttribute('data-lazy'),
                    imageSrcSet = item.getAttribute('data-srcset'),
                    imageSizes = item.getAttribute('data-sizes') || _.getAttribute('data-sizes'),
                    imageToLoad = _.createElement('img');
                
                imageToLoad.onload = () => {
                    animate(image, { opacity: 0 }, 100, () => {
                        if (imageSrcSet) {
                            image.setAttribute('srcset', imageSrcSet);
                            if (imageSizes) {
                                image.setAttribute('sizes', imageSizes);
                            }
                        }
                        image.setAttribute('src', imageSource);
                        animate(image, { opacity: 1 }, 200, () => {
                            image.removeAttribute('data-lazy');
                            image.removeAttribute('data-srcset');
                            image.removeAttribute('data-sizes');
                            image.classList.remove('uc-carousel-loading');
                        });
                        const triggerLazyLoaded = new Event('lazyLoaded', [_, image, imageSource]);
                        _.dispatchEvent(triggerLazyLoaded);
                    });
                };

                imageToLoad.onerror = () => {
                    image.removeAttribute('data-lazy');
                    image.classList.remove('uc-carousel-loading');
                    image.classList.add('uc-carousel-lazyload-error');

                    const triggerLazyLoadError = new Event('lazyLoadError', [_, image, imageSource]);
                    _.dispatchEvent(triggerLazyLoadError);
                };

                imageToLoad.src = imageSource;
            });
        }

        if (_.options.centerMode === true) {
            if (_.options.infinite === true) {
                rangeStart = _.currentSlide + (_.options.slidesToShow / 2 + 1);
                rangeEnd = rangeStart + _.options.slidesToShow + 2;
            } else {
                rangeStart = Math.max(0, _.currentSlide - (_.options.slidesToShow / 2 + 1));
                rangeEnd = 2 + (_.options.slidesToShow / 2 + 1) + _.currentSlide;
            }
        } else {
            rangeStart = _.options.infinite ? _.options.slidesToShow + _.currentSlide : _.currentSlide;
            rangeEnd = Math.ceil(rangeStart + _.options.slidesToShow);
            if (_.options.fade === true) {
                if (rangeStart > 0) rangeStart--;
                if (rangeEnd <= _.slideCount) rangeEnd++;
            }
        }
        loadRange = Array.from(_.querySelectorAll('.uc-carousel-slide')).slice(rangeStart, rangeEnd);

        if (_.options.lazyLoad === 'anticipated') {
            const prevSlide = rangeStart - 1,
                nextSlide = rangeEnd,
                slides = _.querySelectorAll('.uc-carousel-slide');

            for (var i = 0; i < _.options.slidesToScroll; i++) {
                if (prevSlide < 0) prevSlide = _.slideCount - 1;
                loadRange = [...loadRange, slides[prevSlide]];
                loadRange = [...loadRange, slides[nextSlide]];
                prevSlide--;
                nextSlide++;
            }
        }

        const fragment = document.createDocumentFragment();
        loadRange.forEach(item => {
            fragment.appendChild(item);
        })

        loadImages(fragment);

        if (_.slideCount <= _.options.slidesToShow) {
            cloneRange = _.querySelectorAll('.uc-carousel-slide');
            loadImages(cloneRange);
        } else {
            if (_.currentSlide >= _.slideCount - _.options.slidesToShow) {
                cloneRange = _.querySelectorAll('.uc-carousel-cloned').forEach(item => {
                    item.slice(0, _.options.slidesToShow);
                });
                loadImages(cloneRange);
            } else if (_.currentSlide === 0) {
                cloneRange = _.querySelectorAll('.uc-carousel-cloned').forEach(item => {
                    item.slice(_.options.slidesToShow * -1);
                });
                loadImages(cloneRange);
            }
        }
    }

    setSlideClasses = (index) => {
        const _ = this;
        let centerOffset, allSlides, indexOffset, remainder;

        allSlides = _.querySelectorAll('.uc-carousel-slide').forEach(item => {
            item.classList.remove('uc-carousel-active');
            item.classList.remove('uc-carousel-center');
            item.classList.remove('uc-carousel-current');
            item.setAttribute('aria-hidden', 'true');
        });
        this.slides[index].classList.add('uc-carousel-current');

        if (_.options.centerMode === true) {
            const evenCoef = _.options.slidesToShow % 2 === 0 ? 1 : 0;
            centerOffset = Math.floor(_.options.slidesToShow / 2);

            if (_.options.infinite === true) {
                if (index >= centerOffset && index <= (_.slideCount - 1) - centerOffset) {
                    const slide = _.slides.slice(index - centerOffset + evenCoef, index + centerOffset + 1)[0];
                    slide.classList.add('uc-carousel-active');
                    slide.setAttribute('aria-hidden', 'false');
                } else {
                    indexOffset = _.options.slidesToShow + index;
                    const slide = allSlides.slice(indexOffset - centerOffset + 1 + evenCoef, indexOffset + centerOffset + 2)[0];
                    slide.classList.add('uc-carousel-active');
                    slide.setAttribute('aria-hidden', 'false');
                }

                if (index === 0) {
                    allSlides[allSlides.length - 1 - _.options.slidesToShow].classList.add('uc-carousel-center');
                } else if (index === _.slideCount - 1) {
                    allSlides[_.options.slidesToShow].classList.add('uc-carousel-center');
                }
            }
            _.slides[index].classList.add('uc-carousel-center');
        } else {
            if (index >= 0 && index <= (_.slideCount - _.options.slidesToShow)) {
                const slide = _.slides.slice(index, index + _.options.slidesToShow)[0];
                slide.classList.add('uc-carousel-active');
                slide.setAttribute('aria-hidden', 'false');
            } else if (allSlides.length <= _.options.slidesToShow) {
                allSlides.classList.add('uc-carousel-active');
                allSlides.setAttribute('aria-hidden', 'false');
            } else {
                remainder = _.slideCount % _.options.slidesToShow;
                indexOffset = _.options.infinite === true ? _.options.slidesToShow + index : index;

                if (_.options.slidesToShow == _.options.slidesToScroll && (_.slideCount - index) < _.options.slidesToShow) {
                    const slide = allSlides.slice(indexOffset - (_.options.slidesToShow - remainder), indexOffset + remainder)[0];
                    slide.classList.add('uc-carousel-active');
                    slide.setAttribute('aria-hidden', 'false');
                } else {
                    const slide = allSlides.slice(indexOffset, indexOffset + _.options.slidesToShow)[0];
                    slide.classList.add('uc-carousel-active');
                    slide.setAttribute('aria-hidden', 'false');
                }
            }
        }

        if (_.options.lazyLoad === 'ondemand' || _.options.lazyLoad === 'anticipated') {
            // _.lazyLoad();
        }
    }

    initUI = () => {
        const _ = this;

        if (_.options.arrows === true && _.slideCount > _.options.slidesToShow) {
            _.prevArrow.style.display = 'block';
            _.nextArrow.style.display = 'block';
        }

        if (_.options.dots === true && _.slideCount > _.options.slidesToShow) {
            _.dots.style.display = 'block';
        }
    }

    getLeft = (slideIndex) => {
        const _ = this;
        let targetLeft,
            verticalHeight,
            verticalOffset = 0,
            targetSlide,
            coef;

        _.slideOffset = 0;
        verticalHeight = _.slides[0].clientHeight;

        if (_.options.infinite === true) {
            if (_.slideCount > _.options.slidesToShow) {
                _.slideOffset = (_.slideWidth * _.options.slidesToShow) * -1;
                coef = -1;

                if (_.options.vertical === true && _.options.centerMode === true) {
                    if (_.options.slidesToShow === 2) {
                        coef = -1.5;
                    } else if (_.options.slidesToShow === 1) {
                        coef = -2;
                    }
                }
                verticalOffset = (verticalHeight * _.options.slidesToShow) * coef;
            }
            if (_.slideCount % _.options.slidesToScroll !== 0) {
                if (slideIndex + _.options.slidesToScroll > _.slideCount && _.slideCount > _.options.slidesToShow) {
                    if (slideIndex > _.slideCount) {
                        _.slideOffset = ((_.options.slidesToShow - (slideIndex - _.slideCount)) * _.slideWidth) * -1;
                        verticalOffset = ((_.options.slidesToShow - (slideIndex - _.slideCount)) * verticalHeight) * -1;
                    } else {
                        _.slideOffset = ((_.slideCount % _.options.slidesToScroll) * _.slideWidth) * -1;
                        verticalOffset = ((_.slideCount % _.options.slidesToScroll) * verticalHeight) * -1;
                    }
                }
            }
        } else {
            if (slideIndex + _.options.slidesToShow > _.slideCount) {
                _.slideOffset = ((slideIndex + _.options.slidesToShow) - _.slideCount) * _.slideWidth;
                verticalOffset = ((slideIndex + _.options.slidesToShow) - _.slideCount) * verticalHeight;
            }
        }

        if (_.slideCount <= _.options.slidesToShow) {
            _.slideOffset = 0;
            verticalOffset = 0;
        }

        if (_.options.centerMode === true && _.slideCount <= _.options.slidesToShow) {
            _.slideOffset = ((_.slideWidth * Math.floor(_.options.slidesToShow)) / 2) - ((_.slideWidth * _.slideCount) / 2);
        } else if (_.options.centerMode === true && _.options.infinite === true) {
            _.slideOffset += _.slideWidth * Math.floor(_.options.slidesToShow / 2) - _.slideWidth;
        } else if (_.options.centerMode === true) {
            _.slideOffset = 0;
            _.slideOffset += _.slideWidth * Math.floor(_.options.slidesToShow / 2);
        }

        if (_.options.vertical === false) {
            targetLeft = ((slideIndex * _.slideWidth) * -1) + _.slideOffset;
        } else {
            targetLeft = ((slideIndex * verticalHeight) * -1) + verticalOffset;
        }

        if (_.options.variableWidth === true) {
            if (_.slideCount <= _.options.slidesToShow || _.options.infinite === false) {
                targetSlide = _.slideTrack.querySelectorAll('.uc-carousel-slide')[slideIndex];
            } else {
                targetSlide = _.slideTrack.querySelectorAll('.uc-carousel-slide')[slideIndex + _.options.slidesToShow];
            }

            if (_.options.rtl === true) {
                if (targetSlide[0]) {
                    targetLeft = (_.slideTrack.getBoundingClientRect().width - targetSlide[0].offsetLeft - targetSlide.getBoundingClientRect().width) * -1;
                } else {
                    targetLeft = 0;
                }
            } else {
                targetLeft = targetSlide[0] ? targetSlide[0].offsetLeft * -1 : 0;
            }

            if (_.options.centerMode === true) {
                if (_.slideCount <= _.options.slidesToShow || _.options.infinite === false) {
                    targetSlide = _.slideTrack.querySelectorAll('.uc-carousel-slide')[slideIndex];
                } else {
                    targetSlide = _.slideTrack.querySelectorAll('.uc-carousel-slide')[slideIndex + _.options.slidesToShow + 1];
                }

                if (_.options.rtl === true) {
                    if (targetSlide[0]) {
                        targetLeft = (_.slideTrack.getBoundingClientRect().width - targetSlide[0].offsetLeft - targetSlide.getBoundingClientRect().width) * -1;
                    } else {
                        targetLeft = 0;
                    }
                } else {
                    targetLeft = targetSlide[0] ? targetSlide[0].offsetLeft * -1 : 0;
                }
                targetLeft += (_.list.getBoundingClientRect().width - targetSlide.clientWidth) / 2;
            }
        }
        return targetLeft;
    }

    setCSS = (position) => {
        const _ = this;
        let positionProps = {}, x, y;

        if (_.options.rtl === true) {
            position = -position;
        }
        x = _.positionProp == 'left' ? Math.ceil(position) + 'px' : '0px';
        y = _.positionProp == 'top' ? Math.ceil(position) + 'px' : '0px';

        positionProps[_.positionProp] = position;

        if (_.transformsEnabled === false) {
            _.slideTrack.style = { ...positionProps };
        } else {
            positionProps = {};
            if (_.cssTransitions === false) {
                positionProps[_.animType] = 'translate(' + x + ', ' + y + ')';
                // _.slideTrack.style = { ...positionProps };
            } else {
                positionProps[_.animType] = 'translate3d(' + x + ', ' + y + ', 0px)';
                // _.slideTrack.style = { ...positionProps };
            }
            _.slideTrack.style[_.animType] = positionProps[_.animType];
        }
    }

    setFade = () => {
        const _ = this;
        let targetLeft;

        _.slides.forEach((element, index) => {
            targetLeft = (_.slideWidth * index) * -1;

            if (_.options.rtl === true) {
                element.style = {
                    position: 'relative',
                    right: targetLeft,
                    top: 0,
                    zIndex: _.options.zIndex - 2,
                    opacity: 0
                }
            } else {
                element.style = {
                    position: 'relative',
                    left: targetLeft,
                    top: 0,
                    zIndex: _.options.zIndex - 2,
                    opacity: 0
                }
            }
        });
        _.slides[_.currentSlide].style = {
            zIndex: _.options.zIndex - 1,
            opacity: 1
        }
    }

    asNavFor = (index) => {
        const _ = this,
            asNavFor = _.getNavTarget();

        if (asNavFor !== null && typeof asNavFor === 'object') {
            asNavFor.forEach(item = () => {
                //TODO:
                // const target = $(this).slick('getSlick');
                // if (!target.unslicked) {
                //     target.slideHandler(index, true);
                // }
            });
        }
    }

    getNavTarget = () => {
        const _ = this,
            asNavFor = _.options.asNavFor;

        if (asNavFor && asNavFor !== null) {
            // TODO:
            // asNavFor = $(asNavFor).not(_.$slider);
        }
        return asNavFor;
    }

    setDimensions = () => {
        const _ = this;

        if (_.options.vertical === false) {
            if (_.options.centerMode === true) {
                _.list.style.padding = '0px ' + _.options.centerPadding;
            }
        } else {
            _.list.style.height = (_.slides[0].clientHeight * _.options.slidesToShow) + 'px';

            if (_.options.centerMode === true) {
                _.list.style.padding = _.options.centerPadding + ' 0px';
            }
        }

        _.listWidth = _.list.getBoundingClientRect().width;
        _.listHeight = _.list.getBoundingClientRect().height;

        if (_.options.vertical === false && _.options.variableWidth === false) {
            _.slideWidth = Math.ceil(_.listWidth / _.options.slidesToShow);
            _.slideTrack.style.width = Math.ceil((_.slideWidth * _.slideTrack.querySelectorAll('.uc-carousel-slide').length)) + 'px';

        } else if (_.options.variableWidth === true) {
            _.slideTrack.style.width = (5000 * _.slideCount) + 'px'
        } else {
            _.slideWidth = Math.ceil(_.listWidth);
            _.slideTrack.style.height = (Math.ceil((_.slides[0].clientHeight * _.slideTrack.querySelectorAll('.uc-carousel-slide').length))) + 'px';
        }

        const offset = _.slides[0].clientWidth - _.slides[0].getBoundingClientRect().width;
        if (_.options.variableWidth === false) {
            _.slideTrack.querySelectorAll('.uc-carousel-slide').forEach(item => {
                item.style.width = (_.slideWidth - offset) + 'px';
            });
        }
    }

    setHeight = () => {
        const _ = this;

        if (_.options.slidesToShow === 1 && _.options.adaptiveHeight === true && _.options.vertical === false) {
            const targetHeight = _.slides[_.currentSlide].clientHeight;
            _.list.style.height = targetHeight + 'px';
        }
    }

    setPosition = () => {
        const _ = this;

        _.setDimensions();
        _.setHeight();

        if (_.options.fade === false) {
            _.setCSS(_.getLeft(_.currentSlide));
        } else {
            _.setFade();
        }
        const triggerSetPosition = new Event('setPosition', [_]);
        _.dispatchEvent(triggerSetPosition);
    }

    loadSlider = () => {
        const _ = this;

        _.setPosition();

        _.slideTrack.style.opacity = 1;
        _.classList.remove('uc-carousel-loading');

        _.initUI();

        if (_.options.lazyLoad === 'progressive') {
            _.progressiveLazyLoad();
        }
    }

    startLoad = () => {
        const _ = this;

        if (_.options.arrows === true && _.slideCount > _.options.slidesToShow) {
            _.prevArrow.style.display = 'none';
            _.nextArrow.style.display = 'none';
        }

        if (_.options.dots === true && _.slideCount > _.options.slidesToShow) {
            _.dots.style.display = 'none';
        }
        _.classList.add('uc-carousel-loading');
    }

    setProps = () => {
        const _ = this,
            bodyStyle = document.body.style;

        _.positionProp = _.options.vertical === true ? 'top' : 'left';

        if (_.positionProp === 'top') {
            _.classList.add('uc-carousel-vertical');
        } else {
            _.classList.remove('uc-carousel-vertical');
        }

        if (bodyStyle.WebkitTransition !== undefined || bodyStyle.MozTransition !== undefined || bodyStyle.msTransition !== undefined) {
            if (_.options.useCSS === true) {
                _.cssTransitions = true;
            }
        }

        if (_.options.fade) {
            if (typeof _.options.zIndex === 'number') {
                if (_.options.zIndex < 3) {
                    _.options.zIndex = 3;
                }
            } else {
                _.options.zIndex = _.defaults.zIndex;
            }
        }

        if (bodyStyle.OTransform !== undefined) {
            _.animType = 'OTransform';
            _.transformType = '-o-transform';
            _.transitionType = 'OTransition';
            if (bodyStyle.perspectiveProperty === undefined && bodyStyle.webkitPerspective === undefined) _.animType = false;
        }
        if (bodyStyle.MozTransform !== undefined) {
            _.animType = 'MozTransform';
            _.transformType = '-moz-transform';
            _.transitionType = 'MozTransition';
            if (bodyStyle.perspectiveProperty === undefined && bodyStyle.MozPerspective === undefined) _.animType = false;
        }
        if (bodyStyle.webkitTransform !== undefined) {
            _.animType = 'webkitTransform';
            _.transformType = '-webkit-transform';
            _.transitionType = 'webkitTransition';
            if (bodyStyle.perspectiveProperty === undefined && bodyStyle.webkitPerspective === undefined) _.animType = false;
        }
        if (bodyStyle.msTransform !== undefined) {
            _.animType = 'msTransform';
            _.transformType = '-ms-transform';
            _.transitionType = 'msTransition';
            if (bodyStyle.msTransform === undefined) _.animType = false;
        }
        if (bodyStyle.transform !== undefined && _.animType !== false) {
            _.animType = 'transform';
            _.transformType = 'transform';
            _.transitionType = 'transition';
        }
        _.transformsEnabled = _.options.useTransform && (_.animType !== null && _.animType !== false);
    }

    getDotCount = () => {
        const _ = this;
        let breakPoint = 0;
        let counter = 0;
        let pagerQty = 0;

        if (_.options.infinite === true) {
            if (_.slideCount <= _.options.slidesToShow) {
                ++pagerQty;
            } else {
                while (breakPoint < _.slideCount) {
                    ++pagerQty;
                    breakPoint = counter + _.options.slidesToScroll;
                    counter += _.options.slidesToScroll <= _.options.slidesToShow ? _.options.slidesToScroll : _.options.slidesToShow;
                }
            }
        } else if (_.options.centerMode === true) {
            pagerQty = _.slideCount;
        } else if (!_.options.asNavFor) {
            pagerQty = 1 + Math.ceil((_.slideCount - _.options.slidesToShow) / _.options.slidesToScroll);
        } else {
            while (breakPoint < _.slideCount) {
                ++pagerQty;
                breakPoint = counter + _.options.slidesToScroll;
                counter += _.options.slidesToScroll <= _.options.slidesToShow ? _.options.slidesToScroll : _.options.slidesToShow;
            }
        }
        return pagerQty - 1;
    }

    createElement = (elName, elClass, options) => {
        // create HTML Element
        const el = document.createElement(elName);
        // Add class name(s) on the element
        elClass && el.classList.add(...elClass.split(','));

        // If options available
        if (options) {
            // iterate through the object
            for (const key in options) {
                // if the property is from the object add it on element
                if (Object.prototype.hasOwnProperty.call(options, key)) {
                    if (!key.includes('data-')) el[key] = options[key];
                    if (key.includes('data-')) el.setAttribute(key, options[key]);
                }
            }
        }
        return el;
    }

    autoPlay = () => {
        const _ = this;

        _.autoPlayClear();
        if (_.slideCount > _.options.slidesToShow) {
            _.autoPlayTimer = setInterval(_.autoPlayIterator, _.options.autoplaySpeed);
        }
    }

    autoPlayIterator = () => {
        const _ = this;
        let slideTo = _.currentSlide + _.options.slidesToScroll;

        if (!_.paused && !_.interrupted && !_.focussed) {
            if (_.options.infinite === false) {
                if (_.direction === 1 && (_.currentSlide + 1) === (_.slideCount - 1)) {
                    _.direction = 0;
                }
                else if (_.direction === 0) {
                    slideTo = _.currentSlide - _.options.slidesToScroll;

                    if (_.currentSlide - 1 === 0) {
                        _.direction = 1;
                    }
                }
            }
            _.slideHandler(slideTo);
        }
    }

    autoPlayClear = () => {
        const _ = this;

        if (_.autoPlayTimer) {
            clearInterval(_.autoPlayTimer);
        }
    }

    setupInfinite = () => {
        const _ = this;
        let i, slideIndex, infiniteCount;

        if (_.options.fade === true) {
            _.options.centerMode = false;
        }

        if (_.options.infinite === true && _.options.fade === false) {
            slideIndex = null;

            if (_.slideCount > _.options.slidesToShow) {

                if (_.options.centerMode === true) {
                    infiniteCount = _.options.slidesToShow + 1;
                } else {
                    infiniteCount = _.options.slidesToShow;
                }

                for (i = _.slideCount; i > (_.slideCount - infiniteCount); i -= 1) {
                    slideIndex = i - 1;

                    const cloneSlide = _.slides[slideIndex].cloneNode(true);
                    cloneSlide.classList.add('uc-carousel-cloned');
                    cloneSlide.setAttribute('id', '');
                    cloneSlide.setAttribute('data-slide-index', slideIndex - _.slideCount);
                    _.slideTrack.prepend(cloneSlide);
                }
                
                for (i = 0; i < infiniteCount; i += 1) {
                    slideIndex = i;

                    const cloneSlide = _.slides[slideIndex].cloneNode(true);
                    cloneSlide.classList.add('uc-carousel-cloned');
                    cloneSlide.setAttribute('id', '');
                    cloneSlide.setAttribute('data-slide-index', slideIndex + _.slideCount);
                    _.slideTrack.appendChild(cloneSlide);
                }

                _.slideTrack.querySelectorAll('.uc-carousel-cloned [id]').forEach(item => {
                    item.setAttribute('id', '');
                });
            }
        }
    }

    updateDots = () => {
        const _ = this;

        if (_.dots !== null) {
            _.dots.querySelectorAll('li').forEach(item => {
                item.classList.remove('uc-carousel-active');
            });
            _.dots.querySelectorAll('li')[Math.floor(_.currentSlide / _.options.slidesToScroll)].classList.add('uc-carousel-active');
        }
    }

    buildDots = () => {
        const _ = this;

        if (_.options.dots === true && _.slideCount > _.options.slidesToShow) {
            _.classList.add('uc-carousel-dotted');

            const dot = _.createElement('ul', _.options.dotsClass);

            for (let i = 0; i <= _.getDotCount(); i += 1) {
                const li = _.createElement('li');
                li.appendChild(_.options.customPaging.call(this, _, i));
                dot.appendChild(li);
            }

            _.dots = _.options.appendDots.appendChild(dot);
            _.dots.querySelectorAll('li')[0].classList.add('uc-carousel-active');
        }
    }

    updateArrows = () => {
        const _ = this;
        // const centerOffset = Math.floor(_.options.slidesToShow / 2);

        if (_.options.arrows === true && _.slideCount > _.options.slidesToShow && !_.options.infinite) {
            _.prevArrow.classList.remove('uc-carousel-disabled');
            _.prevArrow.classList.setAttribute('aria-disabled', 'false');
            _.nextArrow.classList.remove('uc-carousel-disabled');
            _.nextArrow.classList.setAttribute('aria-disabled', 'false');

            if (_.currentSlide === 0) {
                _.prevArrow.classList.add('uc-carousel-disabled');
                _.prevArrow.classList.setAttribute('aria-disabled', 'true');
                _.nextArrow.classList.remove('uc-carousel-disabled');
                _.nextArrow.classList.setAttribute('aria-disabled', 'false');
            } else if (_.currentSlide >= _.slideCount - _.options.slidesToShow && _.options.centerMode === false) {
                _.nextArrow.classList.add('uc-carousel-disabled');
                _.nextArrow.classList.setAttribute('aria-disabled', 'true');
                _.prevArrow.classList.remove('uc-carousel-disabled');
                _.prevArrow.classList.setAttribute('aria-disabled', 'false');
            } else if (_.currentSlide >= _.slideCount - 1 && _.options.centerMode === true) {
                _.nextArrow.classList.add('uc-carousel-disabled');
                _.nextArrow.classList.setAttribute('aria-disabled', 'true');
                _.prevArrow.classList.remove('uc-carousel-disabled');
                _.prevArrow.classList.setAttribute('aria-disabled', 'false');
            }
        }
    }

    buildArrows = () => {
        const _ = this;

        if (_.options.arrows) {
            _.prevArrow = _.createElement('button', 'uc-carousel-arrow,uc-carousel-prev', { type: 'button', ariaLabel: 'Previous', role: 'button' });
            _.nextArrow = _.createElement('button', 'uc-carousel-arrow,uc-carousel-next', { type: 'button', ariaLabel: 'Next', role: 'button' });
    
            if (_.slideCount > _.options.slidesToShow) {
                _.prevArrow.classList.remove('uc-carousel-hidden');
                _.prevArrow.removeAttribute('aria-hidden');
                _.prevArrow.removeAttribute('tabindex');

                _.nextArrow.classList.remove('uc-carousel-hidden');
                _.nextArrow.removeAttribute('aria-hidden');
                _.nextArrow.removeAttribute('tabindex');

                _.prepend(_.prevArrow);
                _.append(_.nextArrow);

                if (_.options.infinite !== true) {
                    _.prevArrow.classList.add('uc-carousel-disabled');
                    _.prevArrow.setAttribute('aria-disabled', true);
                }
            } else {
                _.prevArrow.classList.add('uc-carousel-hidden');
                _.prevArrow.setAttribute('aria-hidden', true);
                _.prevArrow.setAttribute('tabindex', '-1');

                _.nextArrow.classList.add('uc-carousel-hidden');
                _.nextArrow.setAttribute('aria-hidden', true);
                _.nextArrow.setAttribute('tabindex', '-1');
            }
        }
    }

    buildOut = () => {
        const _ = this;
        // Create a new div element to wrap the elements
        const trackWrapper = _.createElement('div', 'uc-carousel-track,slides', { "role": "listbox" });
        const listWrapper = _.createElement('div', 'uc-carousel-list', { "ariaLive": "polite" });
 
        _.slideCount = _.slides.length;

        // Add the slides to the track
        _.slides.forEach((slide, i) => {
            slide.classList.add('uc-carousel-slide');
            slide.setAttribute('data-slide-index', i);
            trackWrapper.appendChild(slide);
        });
        
        listWrapper.appendChild(trackWrapper);
        _.appendChild(listWrapper);
        _.classList.add('uc-carousel-slider');

        _.slideTrack = trackWrapper;
        _.list = listWrapper;
        trackWrapper.style.opacity = 0;

        if (_.options.centerMode === true || _.options.swipeToSlide === true) {
            _.options.slidesToScroll = 1;
        }

        _.querySelectorAll('img[data-lazy]:not([src])').forEach(item => {
            item.classList.add('uc-carousel-loading');
        });

        _.setupInfinite();
        _.buildArrows();
        _.buildDots();
        _.updateDots();

        _.setSlideClasses(typeof _.currentSlide === 'number' ? _.currentSlide : 0);

        if (_.options.draggable === true) {
            _.list.classList.add('draggable');
        }
    }
}

customElements.define('uc-carousel', UnityCarousel);