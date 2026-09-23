Display the following website, which checks GPU info for PACE Phoenix cluster. 

here is the website: 
https://ondemand-phoenix.pace.gatech.edu/pun/sys/shell/ssh/login-phoenix.pace.gatech.edu

if I can reach it, I should see a shell prompt. I need to type a command to check the gpu info. which is as follows:

sinfo -o "%20P %10c %10m %25F" | grep -E '^PARTITION|^gpu'

Column HeaderFormat FlagWhat It MeansPARTITION%20PThe queue name. An asterisk (*) next to a name (like cpu-small*) indicates it is the default partition if none is specified.CPUs%10cThe number of CPU cores available per compute node in that partition. A + (e.g., 24+) indicates nodes in that partition have varying core counts, with the minimum shown.MEMORY%10mConfigured RAM per node in Megabytes (MB). For instance, 191000+ is ~191 GB, 515000+ is ~512 GB, and 2063000 is ~2 TB. A + means memory varies across nodes in that pool.NODES(A/I/O/T)%25FThe node availability state broken down as Allocated / Idle / Other / Total.

also help me display me the code for checking pending jobs for each gpu queue. 

squeue -h -t PENDING -p gpu-v100,gpu-a100,gpu-h100,gpu-h200,gpu-l40s,gpu-rtx6000,gpu-rtxpro-blackwell -o "%P"   | tr ',' '\n'   |
 sort   | uniq -c   | sort -rn


also help me include the oct1, 2026 rate in a nice table and display it. 


help me make a simple flask website display the above info. 
please use gatech color theme:
Gold
CMYK: 0, 19, 54, 29 
HEX: #B39051
RGB: 179, 144, 81
PMS: 118*
Metallic PMS: 10126

*Closest Pantone match to color
 

 
White
CMYK: 0, 0, 0, 0
HEX: #FFFFFF
RGB: 255, 255, 255
 

 
Navy
CMYK: 96, 82, 47, 58 
HEX: #051E39
RGB: 5, 30, 57
PMS: 2380*

*Closest Pantone match to color
 

 
Dark Gold
CMYK: 39, 49, 86, 18 
HEX: #8F713D
RGB: 143, 113, 61
PMS: n/a
 