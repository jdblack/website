---
title: "Clustering Cinc and Chef Server Part 2"
date: 2023-02-11T22:39:23+07:00
draft: true
categories:
 - devops
tags:
 - config management
 - chef
 - cinc
---

This article is the second of a series that covers dockerizing Chef/Cinc
infrastructure server for the purposes of running it within Kubernetes. By the
end of this article you will understand how to build Chef/Cinc Server in
docker,  how to reference externalized services like PostGres and OpenSearch,
and how to propagate the Chef secrets between instances of the Chef/Cinc API sever

<!--more-->

Welcome back to our series on Clusterizing Chef and Cinc within Kubernetes!

For the rest of this article we'll be using the terms  **Cinc** and **Chef**
interchangably.  These instructions will work equally well for either project,
provided you account for the slight naming diverences between projects.  [The
Cinc About Page](https://cinc.sh/about/) explains why these projects have
diverged.


## Prerequisites

 - An opensearch 1.x cluster that talks HTTP (Cinc does not support HTTPS yet)
 - A postgresql server for which you can give Cinc the admin password to.
 - A kubernetes Service account to fetch and create Kubernetes Secrets



## Setting up a dockerfile

Our dockerfile is responsible for a few things: Setting up the operating
system, installing Cinc Infra Server, setting up some init scripts (to be
explained at length below) and preparing the Server for configuration.
The first `cinc-server-ctl reconfigure` will actually happen when the
container is actually launched.







```docker


```
