---
title: "Ceph in K8s"
date: 2023-02-09T12:25:05+07:00
categories:
 - notes
tags:
 - k8s
 - ceph
---

My raw notes on installing ceph in K8s. This information is exploratory in
nature and should not be relied on in production enviornments
<!--more-->


## Installation

### Rook operator
This installs and manages ceph clusters
```
helm repo add rook-release https://charts.rook.io/release
# Note: --set "enableDiscoveryDaemon=true" might be necessary if you want
# want to set node definitions in cephclusters

helm install --create-namespace --namespace rook-ceph rook-ceph \
  rook-release/rook-ceph  # --set "enableDsicoveryDaemon=true"
```

### Rook-Ceph cluster
This helm chart instructs the rook operator above to install a ceph cluster

```
helm install --create-namespace --namespace rook-ceph rook-ceph-cluster \ 
  --set operatorNamespace=rook-ceph rook-release/rook-ceph-cluster
```


## Teardown

Ceph does not go down without a fight. You'll need to do 4 things to return to
a pristine state:

### Remove finalizers from 3 objects

Finalizers are put into the cephcluster, secret and configmap objects to
protect ceph. We'll need to remove those finalizers before helm will be
able to delete the rook-ceph deployment

 1. `kubectl edit cephcluster rook-ceph -n rook-ceph'
 2. `kubectl edit secret rook-ceph-mon -n rook-ceph`
 3. `kubectl edit cm rook-ceph-mon-endpoints -n rook-ceph`


### Tear down helm
With the finalizers gone, we can delete the helm charts

 1. `helm delete rook-ceph-cluster -n rook-ceph`
 2. `helm delete rook-ceph -n rook-ceph`


## The rook-ceph namespace wont go away

If you're like me, you probabably forgot to remove the finalizers. Go back and
go "Remove Finalizers".  You should now  be able to do `kubectl delete ns rook-ceph`

Sometimes there are more finalizers that need to go.  Running `kubectl describe
ns rook-ceph` will give log of prior events.  In this example, we can see
that  there are still a `cephblockpool` and `cephobjectstore` object.  Find
them with  `kubectl get cephblockpool -n rook-ceph`, edit them, and remove
the finalizers as with the other examples

```
~$ k describe namespace rook-ceph
Name:         rook-ceph
Labels:       kubernetes.io/metadata.name=rook-ceph
              name=rook-ceph
Annotations:  <none>
Status:       Terminating
Conditions:
  Type                                   Status  LastTransitionTime               Reason                Message
  ----                                         ------  ------------------               ------                -------

  NamespaceFinalizersRemaining                 True    Thu, 09 Feb 2023 13:21:16 +0700  SomeFinalizersRemain  Some content in the namespace has finalizers remaining: cephblockpool.ceph.rook.io in 1 resource instances, cephobjectstore.ceph.rook.io in 1 resource instances




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
```
for x in k8smaster k8sn1 k8sn2 k8sn3; do
   ssh $x "sudo rm -rf /var/lib/rook";
   ssh $x "sudo dd if=/dev/zero of/dev/dm-1 bs=4096 count=10240";
done
```




# Configuration

# Loose Notes



