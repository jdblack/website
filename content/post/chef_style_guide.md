---
title: "Chef Style Guide"
date: 2023-01-19T11:27:28+07:00
toc: false
categories:
 - devops
tags:
 - config management
 - chef
 - cinc
draft: true
---

The intent of Chef and Cinc is to manage your infrastructure as code. This
approach provides all of the benefits of code, such as version control
management, peer review and CI/CD, along with many of the same drawbacks. 
This article provides a set of guidelines that will help you keep your 
cookbooks simple and easy to read.

<!--more-->

Our guiding principle in this document is that simplicity is king.  CPU time is
fast and  cheap, engineers are slow and expensive. Our cookbooks should be
written to be as clear as possible to as many as possible.  Cookbooks can
quickly become complicated sprawling piles of spaghetti if one does not put
thought into the code style that they follow with their cookbook development.  

Guidelines are not walls. There will be times in which the simplest approach
contradicts these guidelines. When that happens, simplicity should win out over
these rules of thumb.


# Avoid pointless interpolation

{{<section>}}
{{<column>}}

```ruby
root_dir = "/var/lib/src"
name = "bitminer"
full_path = "#{root_dir}/#{name}"

## Lets look at the output
puts full_path
"/var/lib/src/bitminer"
```

{{</column>}}
{{<column>}}

Interpolation, shown on the left, is a useful way to build complex strings from
one or more simpler ones.  Many folk find `#{user}:#{pass}@#{hostname}#{path}"`
much easier to read than `user + ":" + pass + "@" + hostname + path`

Interpolation is wasteful, though, if you're just using a single string without
any modifications. In these cases, just pass in the variable itself without
interpolation. E.G.rather than using `"#{node['username'}"`,  just use
`username`

{{</column>}}
{{</section>}}

{{<section>}}
{{<column width="50%">}}
### Before

In this example, we can see that the username has been wrapped into a string.
There is no need to do this in recipes unless you are combining multiple 
strings together.

```ruby
template "/etc/someservice.cnf" do
  source "someservice.cnf.erb"
  variables(
    username: "#{node['someservice']['username']"
  )
end
```

{{</column>}}
{{<column width="50%">}}
### After

We can simply this very easily by removing the quotes! Without the unnecessary
interpolation, this resource is both easier to read and avoids unnecessary
work by the parser.

```ruby
template "/etc/someservice.cnf" do
  source "someservice.cnf.erb"
  variables(
    username: node['someservice']['username']
  )
end
```

{{</column>}}
{{</section>}}

# Don't use node[] inside of ERB templates

It's easy and tempting to reference the node object from within templates. This 
should be avoided, however, for a couple very important issuer.  Firstly, a
template resource definition should clearly define the variables that it 
depends on.  We We should express this dependency by defining 


{{<section>}}
{{<column width="50%">}}

While looking at the recipe, it's impossible to tell that this template
resource is dependent upon `node['myservice']` being defined.

```ruby


# recipes/somerecipe.rb

template "/etc/someservice.conf" do
  source "someservice.conf.erb"
end
```

```ruby
# templates/default/someservice.conf.erb
[some_section]
username = "<%= node['myservice']['username'] %>"
password = "<%= node['myservice']['password'] %>"
```

{{</column>}}
{{<column width="50%">}}

We can be more clear about this dependency by using a variables block and
passing them into the template.  With this small change, its much easier to
tell what this template needs to be happy

```ruby
# recipes/somerecipe.rb

template "/etc/someservice.conf" do
  source "someservice.conf.erb"
  variables(
     username: node['myservice']['username'],
     password: node['myservice']['password'],
  )
end
```

```ruby
# templates/default/someservice.conf.erb
[some_section]
username = "<%= @username %>"
password = "<%= @password %>"
```
{{</column>}}
{{</section>}}

# Skip the defaults when defining resources!

A good recipe is like a good story. In a good story, we talk about the interesting
parts and skip over details that are boring.  A resource definition is the same 
way! In the case of resource definitions, our unnecessary details come as 
resource properties

Most resource types have numerous properties that can be specified. These properties,
usually have sensible defaults. Specifying an already default property for resource
can occasionally be useful for clarificaton, but usually causes resource definitions
to bloat up and become unweildy.

Both of these sets of resources do the same thing. Which one would you rather read?  What if
there were 40 resources in the recipe instead of three?

{{<section>}}
{{<column>}}
```ruby
directory "/etc/someservice"

template "/etc/someservice/main.config" do
  mode '0444'
  notifies :restart, 'service[myservice]'
end

service "myservice" do
  action [:enable, :start]
  subscribes :restart, 'template[/etc/someservice/main.config]'
end

```
{{</column>}}
{{<column>}}
```ruby
directory "/etc/someservice" do
  action :create
  path '/etc/someservice'
  owner 'root'
  group 'root'
  mode '0755'
  recursive false
end

template "/etc/someservice/main.config" do
  source 'main.config.erb'
  owner 'root'
  group 'root'
  mode '0444'
  notifies :restart, 'service[myservice]', :delayed
end

service "myservice" do
  action [:enable, :start]
  timeout 900
end

```
{{</column>}}
{{</section>}}


# Conditionals should focus on wanted features, not roles or envs!




{{<section>}}
{{<column>}}
Its quite common in chef and cinc to want to apply some resources withinin a
recipe on some systems, but not others. We do this by relying upon the
`only_if` and `not_if` conditionals within resources
{{</column>}}
{{<column>}}
``ruby
file "/etc/arbitrary_example" do
  content "imagine a funny joke here"
  only_if { 1+1 == 2 }
end
```
{{</column>}}
{{</section>}}


# Resource backups are your friend

Many resources in Cinc and Chef automatically keep five backups of any files
that are changed during chef runs. You can find these backups in either
/var/cinc/backup or /var/chef/backup.  The backup dir stucture is the same
as the underlying filesystem, with the date appended at the end. for example


{{<section>}}
{{<column>}}
```ruby
template "/etc/cinc/client.rb" do
  source "cinc-client.rb.erb"
  variables(
    server: Chef::Config['chef_server_url'],
    name: node.name
  )
end
```

{{</column>}}
{{<column>}}

```bash
jblack@k8smaster:/$ ls /etc/cinc/client.rb
/etc/cinc/client.rb
jblack@k8smaster:/$ find /var/cinc/backup -iname 'client.rb*'
/var/cinc/backup/etc/cinc/client.rb.chef-20230114082335.126178
/var/cinc/backup/etc/cinc/client.rb.chef-20230114082500.822215
/var/cinc/backup/etc/cinc/client.rb.chef-20230114083933.781495
jblack@k8smaster:/$
```



{{</column>}}
{{</section>}}

The backups are whole file backups, making diff particularly useful in determining exactly what
changed.

```diff
jblack@k8smaster:~$ diff -u  /etc/cinc/client.rb /var/cinc/backup/etc/cinc/client.rb.chef-20230114083933.781495
--- /etc/cinc/client.rb	2023-01-14 08:39:33.756517295 +0000
+++ /var/cinc/backup/etc/cinc/client.rb.chef-20230114083933.781495	2023-01-14 08:25:39.108602919 +0000
@@ -1,5 +1,3 @@
 chef_server_url "https://cinc/organizations/linuxguru"
 node_name "k8smaster"
 log_location :syslog
-trusted_certs "/etc/ssl/certs"
-
```


# Code belongs in libraries, not recipes

Recipes are inherently ruby code, so it becomes tempting to sneak in language
constucts that should normally be avoided.

```ruby

#somerecipe.rb

some_arbitrary_data = JSON.parse("/etc/cluster_config.json")
if  

```


{{<section>}}
{{<column>}}
{{</column>}}
{{<column>}}
{{</column>}}
{{</section>}}


# Be allergic to Conditionals
{{<section>}}
{{<column>}}
{{</column>}}
{{<column>}}
{{</column>}}
{{</section>}}


# Holding packages safely

{{<section>}}
{{<column>}}
{{</column>}}
{{<column>}}
{{</column>}}
{{</section>}}


# include\_recipe is best used within the same cookbook
{{<section>}}
{{<column>}}
{{</column>}}
{{<column>}}
{{</column>}}
{{</section>}}


# Using /tmp for downloads and lockfiles is unnecessarily risky

{{<section>}}
{{<column>}}
Creating and using temporary files is common activity during Chef runs.  For
example, we may wish to download a package that is not available from an apt
repository and install it.  

The `/tmp` and `/var/tmp` directories should be avoided for two reasons: safety
and idempotency.  These directories are writeable by any process on the
filesystem, which leaves any resource that writes predicticably named temp
files vulnerable to a bait-and-switch attack.  Its also common in many
production environments for these temp directories to be automatically pruned
and/or mounted as memory backed  tmpfs filesystems.


A better location for temp files created during chef is `/var/cache`.  This
directory is only writeable by root, is conventionally mounted, and is usually
not automatically cleaned up by automation. Relying on a static location like
`/var/cache` also allows us to rely upon idempotency to determine whether or
not the package should be reinstalled.

{{</column>}}
{{<column>}}

```ruby
server  ="http://webserver.mycompany.com"
version node['mypackage']['version']

remote_file 'mypackage' do
  path "/var/cache/mypackage.deb"
  source "${server}/${mypackage-${version}.deb"
end

dpkg_package "mypackage"  do
  subscribes :install, 'remote_file[mypackage]', :immediate
end

```

{{</column>}}
{{</section>}}

