I need a light web page to display gpu info for pace phenix cluster. primmarily showing whther a GPU is available or not. In the background, the web page should only check when I hit referesh button.

the following website can only reach when login using ssh key and enter the vpn.  So display not login in screen if the web page can't reach the website.

here is the website: 
https://ondemand-phoenix.pace.gatech.edu/pun/sys/shell/ssh/login-phoenix.pace.gatech.edu

if I can reach it, I should see a shell prompt. I need to type a command to check the gpu info. which is as follows:

sinfo -o "%20P %10c %10m %25F" | grep -E '^PARTITION|^gpu'

Column HeaderFormat FlagWhat It MeansPARTITION%20PThe queue name. An asterisk (*) next to a name (like cpu-small*) indicates it is the default partition if none is specified.CPUs%10cThe number of CPU cores available per compute node in that partition. A + (e.g., 24+) indicates nodes in that partition have varying core counts, with the minimum shown.MEMORY%10mConfigured RAM per node in Megabytes (MB). For instance, 191000+ is ~191 GB, 515000+ is ~512 GB, and 2063000 is ~2 TB. A + means memory varies across nodes in that pool.NODES(A/I/O/T)%25FThe node availability state broken down as Allocated / Idle / Other / Total.


I want to see the info for gpu partition.  if the gpu is available, the node is idle, then the gpu is available. please give me a nice clean table to show the info. 

---

## Quick Start

### 1. Launch the Server
To start the dashboard locally:
```bash
./start.sh
# Or specify a custom port:
./start.sh 8080
```

### 2. Open in Browser
Navigate to [http://localhost:8080](http://localhost:8080).

### 3. Connection & Usage
- **Live Queries**: When you click the **Refresh** button, the server queries PACE Phoenix via SSH using:
  ```bash
  ssh dliu450@login-phoenix.pace.gatech.edu 'sinfo -o "%20P %10c %10m %25F" | grep -E "^PARTITION|^gpu"'
  ```
- **If Not Connected**: If GT VPN is not connected or SSH key is not authorized, the dashboard automatically presents the **"Not Logged In"** screen with a direct link to the [PACE Open OnDemand Shell](https://ondemand-phoenix.pace.gatech.edu/pun/sys/shell/ssh/login-phoenix.pace.gatech.edu).
- **Demo Mode**: You can toggle Demo Mode in Settings or on the unreachable screen to preview the UI offline.
- **Manual Paste**: You can also paste raw output directly using the **Paste Output** button.
 