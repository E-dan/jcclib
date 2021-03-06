JCC JavaScript Client controls
==============================

Concept Overview
-----------------

Web pages often require the content displayed to visitors to be dynamic. This
allows to increase the relevance and customization of a web page according to
a remote or local data source. One solution to this requirement is to create
the final output on the "server side" and then deliver the finalized page to
visitors. Another proposed solution is to allow the "client side" to evaluate
and render the information locally and independently from the server. The
latter solution allows for lower server-client overhead as the formatting is
done mostly on the client side. JavaScript Client Controllers (JCC) is a
JavaScript library that aims to deliver a solution in the form of "client-
side" data formatting (the second approach mentioned above). The library
provides an API to develop Client Controls that may later on be used in web
pages to format and display information on the "client side" in a dynamic way.
The same information may be displayed in numerous forms (e.g. tables, graphs,
lists etc) without having to request additional data from the server.

Goal
----

The goal was to create a JavaScript library that will allow web developers to
focus on building content instead of worrying about JavaScript and maintaining
HTML templates. JCC basically allows you to turn every regular HTML page into
a dynamic, data-driven web application and in zero setup cost. You don't need
a JSP server, and barely any server-side processing power. We allow you to
deliver smaller web pages that are scalable and dynamic. One may say, JCC is
to HTML as jQuery is to JavaScript. It's your "get work done" library.

So how do I use it?
-------------------

After you download and set up an HTML page to use JCC, you are pretty much
ready to go! Each place in your document where you want to use JCC magic, just
add the "jcc" (saved word) class to that HTML element. Like so:

    <p class="jcc">...</p>

Once tagged with the jcc class, this element is referred to as a JCC container
or JCC context. Now you can start using the JCC magic inside that element by
playing with the different JCC attributes described throughout the
documentation.