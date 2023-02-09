---
title: "Ceph in K8s"
date: 2023-02-09T12:25:05+07:00
toc: false
categories:
 - notes
 - on hold
tags:
 - k8s
 - ceph
---


In this note, I cover the details that I have uncovered thus far with rook and
ceph.  Ceph is a distributed filesystem that provides persistent storage,
S3-like object store and NFS support in one happy container.  Ceph can be quite
difficult to install the first couple times. Rook is intended to make deploying
Ceph much easier.  

Unfortunately, Ceph's resource requirements exceed that of my little home
lab, which consists of four systems with four cores and sixteen gigs of ram
each. I'll reexplore this topic when I have expanded the cluster to six or
eight nodes.


<!--more-->
{{<section>}}
{{<column width="60em">}}
{{< toc >}}
{{</column>}}
{{<column width="40em">}}
{{< figure src="../ceph/harder.jpg" title="first ceph experiences" width=320 >}}
{{</column>}}
{{</section>}}



## Installation

Installation involves installing two helm charts;  helm-rook to install the
rook operator, and helm-rook-ceph, which sets up a cephcluster object among
other components.


### Rook operator
This installs the rook operator, which watches for the creation of the 
Ceph related custom resource definitions that it provices and actaully
creates them.


```
helm repo add rook-release https://charts.rook.io/release
# Note: --set "enableDiscoveryDaemon=true" might be necessary if you want
# want to set node definitions in cephclusters

helm install --create-namespace --namespace rook-ceph rook-ceph \
  rook-release/rook-ceph  --set "enableDiscoveryDaemon=true"

# This will start you off with the rook operator and one discover pod
# per node

~/code/linuxguru$ k get pods -n rook-ceph
NAME                                  READY   STATUS    RESTARTS   AGE
rook-ceph-operator-559cbcdf67-x28sb   1/1     Running   0          20s
rook-discover-4kmxq                   1/1     Running   0          16s
rook-discover-86l8b                   1/1     Running   0          16s
rook-discover-cp97c                   1/1     Running   0          16s
rook-discover-k9lx9                   1/1     Running   0          16s

```



### Rook-Ceph cluster
This helm chart creates a pile of ceph custom resource definitions that are
picked up by the rook operator above.

```
helm install --create-namespace --namespace rook-ceph rook-ceph-cluster \ 
  --set operatorNamespace=rook-ceph rook-release/rook-ceph-cluster

~/code/linuxguru$ k get cephcluster -A -w
NAMESPACE   NAME        DATADIRHOSTPATH   MONCOUNT   AGE   PHASE         MESSAGE                 HEALTH   EXTERNAL
rook-ceph   rook-ceph   /var/lib/rook     3          90s   Progressing   Configuring Ceph Mons
rook-ceph   rook-ceph   /var/lib/rook     3          98s   Progressing   Configuring Ceph Mgr(s)
rook-ceph   rook-ceph   /var/lib/rook     3          2m8s   Progressing   Configuring Ceph OSDs
rook-ceph   rook-ceph   /var/lib/rook     3          4m20s   Ready         Cluster created successfully
rook-ceph   rook-ceph   /var/lib/rook     3          4m33s   Ready         Cluster created successfully   HEALTH_WARN
```

After a few minutes, the cluster is up. In my case, the cluster is unhealhty
becuase I do not have any volumes attached to the cluster and LVM volumes are
not automatically added. To fix this, I add the nodes and volumes manually,
which I discuss below under Configuration


## Configuration

### LVM Volumes

Most of the documentation that I came across seems to indicate that LVM volumes
with rook-ceph are problematic. Ceph itself can handle LVM volumes, but
currently Rook intentionally skips LVM volumes. I was able to use LVM volumes
by adding them manually in the ceph cluster It appears that [this pull
request](https://github.com/rook/rook/pull/7967) intentionally disabled
automatic adding of logical volumes to "avoid unwanted LV consumption on
upgrade."


```yaml
apiVersion: ceph.rook.io/v1
kind: CephCluster
...
...
spec:
  storage:
    useAllDevices: false  [originally true]
    useAllNodes: false [ originally true]
    nodes:
    - name: k8sn1
      devices:
      - name: dm-1
    - name: k8sn2
      devices:
      - name: dm-1
    - name: k8sn3
      devices:
      - name: dm-1
    - name: k8smaster.vn.linuxguru.net
      devices:
      - name: dm-1
```

## Teardown

Ceph does not go down without a fight. You'll need to do 4 things to return to
a pristine state:

### Tear down helm
First, lets tear down helm

 1. `helm delete rook-ceph-cluster -n rook-ceph`
 2. `helm delete rook-ceph -n rook-ceph`


### The rook-ceph namespace wont go away

Finalizers are put into the cephcluster, secret and configmap objects to
protect ceph. We'll need to remove those finalizers before helm will be
able to delete the rook-ceph deployment

The error for the namesapce will look like this:
```
~$ k describe namespace rook-ceph
Name:         rook-ceph
Labels:       kubernetes.io/metadata.name=rook-ceph
              name=rook-ceph
Annotations:  <none>
Status:       Terminating
Conditions:
 Type        Status  LastTransitionTime  Reason      Message
 ----        ------  ------------------  ------      -------
 Namespace   True    09 Feb  13:21:16    Some        Some content in the namespace has finalizers remaining:
 Finalizers                              Finalizers  cephblockpool.ceph.rook.io in 1 resource instances,
 Remaining                               Remain      cephobjectstore.ceph.rook.io in 1 resource instances
```

You can use the following command to find all of the stuck objects and 
delete them:


` kubectl api-resources --verbs=list --namespaced -o name | xargs -n 1 kubectl get --show-kind --ignore-not-found -n rook-ceph`

Edit each one of the objects listed and remove their finalizers

For example, do a `kubectl get cephblockpool -n rook-ceph`, which will show the
remaining block pool. `kubectl edit` that, remove  the Finalizers stanza, and
you're good to go.


### Clean up nodes

Rook and Ceph leave stuff the nodes that will get in the way if you try to
reinstall them later.  New builds will fail to work if you forget to clean this
first. **This includes any masters for which you have removed the noschedule
taint!**

These actions have to performed on all nodes:

 1. `rm -rf /var/lib/rook`
 2. For any block device used by ceph:  `dd if=/dev/zero of=/dev/DEVICE bs=4096
    count=10240`

For me, that looks like:

```shell
for x in k8smaster k8sn1 k8sn2 k8sn3; do
   ssh $x "sudo rm -rf /var/lib/rook";
   ssh $x "sudo dd if=/dev/zero of=/dev/dm-1 bs=4096 count=10240";
done
```


# Loose Notes



