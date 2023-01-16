---
title: "Clustering cinc or chef"
date: 2023-01-16T15:27:28+07:00
categories:
 - devops
tags:
 - config management
 - chef
 - cinc
draft: true
---

~~Chef~~ Cinc is surprisingly simple to set up, especially considering
the amount of underlying complexity that is hidden from the user.


```
# curl -L https://omnitruck.cinc.sh/install.sh | sudo bash -s -- -P cinc-server -v 14
# cinc-server-ctl reconfigure
 
```
Sure enough, we have a brand new ~~Chef~~ Cinc server, ready to manage 
hundreds, or evne thousands of clients. It almost feels too easy, doesn't
it?

Let's take a look at what we have..

{{< mermaid >}}
flowchart LR
clients[/cinc clients/]-->cinc[api server]
subgraph Standalone Chef
cinc-->postgres
cinc-->opensearch
cinc-->others(and a slew of other services)
end
{{</mermaid >}}

From our perspective, it's just a ~~Chef~~ Cinc server, taking and 
serving request. Under the blankets, though, there's a bit more to it.
Things, at least at first, are just fine!  

As time passes, it becomes more clear that our entire infrastructure is
dependent upon that server never, ever going down.  Something as simple as a
kernel upgrade on your ~~Chef~~ Cinc server often causes the entire
organization to become rudderless. Your organization loses the ability to scale
new app servers, becuase chef is down. SecOps become rudderless, as they lose
the ability to patch zero days, because the ~~chef~~ cinc server is down.
Tools that rely upon inventory management lose the ability to watch systems.
It can get ugly.  Its our responsibility to avoid single points of failure like
these. 

There is thankfully a process by which we can run as many ~~chef~~ cinc servers
as we want!  The api server itself is stateless and we can run as many of them
as we want, as long as we externalize the Postgres Database and Opensearch
Cluster. The rest of the stuff, nginx, reddis, rabbitmq can stay right 
where it is.

{{< mermaid >}}
flowchart LR
clients[/cinc clients/]-->cinclb
cinclb-->cinc1
cinclb-->cinc2
subgraph DB
postgres
end
subgraph cluster[Cinc Cluster]
cinclb>load balancer]
cinc1[api server 1]
cinc2[api server ..n]
end
subgraph Search
opensearch
end
cluster-->opensearch
cluster-->postgres
{{</mermaid >}}


Things are slightly more complicated then the above chart, but not by 
very much.  Firstly, redundancy for the database server must be addressed, 
either by using Amazon RDS in multi-az mode (which will handle all failover
for you), or manually setting up some sort of replication and failover 
process with the database server.


Setting up redundancy with opensearch is less important, as the data can be
regenerated at any time by running "cinc-server-ctl reindex" on any of the cinc
api servers. That said, setting up replication for Opensearch is rather easy
and should be done if you have the money to cover the cost three systems.

RDS and amazon OpenSearch can handle that redundancy for you, but if you want
to build a fully redundant architecture build-it-my-own-self style, you're
looking at the following:

{{< mermaid >}}
flowchart LR
clients(cinc clients)-->cinclb
subgraph CincAPI
cinclb>Cinc LB]
cinclb-->cinc1[api server 1]
cinclb-->cinc2[api server ..n]
end
CincAPI-->heartbeat
CincAPI-->opensearchLB
subgraph DB
heartbeat>heartbeat]
heartbeat<-->postgresPrimary
heartbeat<-->postgresSecondary
end
subgraph Search
opensearchLB>OpenSearchLB]
opensearchLB-->opensearch1
opensearchLB-->opensearch2
opensearchLB-->opensearch3
end
{{</mermaid >}}


