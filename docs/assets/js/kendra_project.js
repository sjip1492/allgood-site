$(document).ready(function(){
    $('.project-images').slick({
        infinite: true,
        slidesToShow: 1,
        centerMode: true,
        variableWidth: true,
        arrows: true,
        autoplay: true,
        autoplaySpeed: 2500,
        accessibility: true,
        pauseOnHover: true,
        appendArrows: $('.project-image-nav')
    });
});