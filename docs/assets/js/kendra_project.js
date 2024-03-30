$(document).ready(function(){
    $('.project-images').slick({
        infinite: false,
        slidesToShow: 1,
        slidesToScroll: 1,
        centerMode: true,
        variableWidth: true,
        arrows: true,
        autoplay: false,
        accessibility: true,
        pauseOnHover: true,
        responsive: true,
        appendArrows: $('.project-image-nav')
    });
});