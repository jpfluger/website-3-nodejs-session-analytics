/* global $ */
/* global alert */

$(document).ready(function () {
  // when using bootstraps's nav-menu components, don't define the active menu on the server
  // rather, to make active, match on the pathanme to the a.href attribute
  $('#mainNavBar a').each(function () {
    if (window.location.pathname === $(this).attr('href')) {
      $(this).closest('li').addClass('active')
      // return false
    } else {
      $(this).closest('li').removeClass('active')
    }
  })

  // test button click
  $('#button1').click(function (ev) {
    ev.preventDefault()
    console.log('clickme')
    alert('Handler for .click() called.')
  })
})
