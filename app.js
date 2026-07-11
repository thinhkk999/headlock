function app() {
  return {
    isLoggedIn: false,
    username: '', 
    password: '', 
    token: '',
    packages: [], 
    keys: [], 
    selectedPkg: '', 
    newPkgName: '',
    keyPrefix: '', 
    keyQuantity: '', 
    duration: '', 
    durationType: 'Ngày', 
    maxDevices: '', 
    multiDevice: true,
    searchKey: '',
    
    // Pagination properties
    currentPage: 1,
    pageSize: 10,
    
    // Computed properties
    get filteredKeys() {
      if (!this.searchKey) return this.keys;
      return this.keys.filter(k => 
        k.key.toLowerCase().includes(this.searchKey.toLowerCase()) ||
        (k.package?.name && k.package.name.toLowerCase().includes(this.searchKey.toLowerCase()))
      );
    },
    
    get totalPages() {
      return Math.ceil(this.filteredKeys.length / this.pageSize);
    },
    
    get paginatedKeys() {
      const start = (this.currentPage - 1) * this.pageSize;
      const end = start + parseInt(this.pageSize);
      return this.filteredKeys.slice(start, end);
    },
    
    get startIndex() {
      return (this.currentPage - 1) * this.pageSize;
    },
    
    get endIndex() {
      return this.startIndex + parseInt(this.pageSize);
    },
    
    get visiblePages() {
      const pages = [];
      const total = this.totalPages;
      const current = this.currentPage;
      
      // Always show first page
      pages.push(1);
      
      // Calculate range around current page
      let start = Math.max(2, current - 1);
      let end = Math.min(total - 1, current + 1);
      
      // Add ellipsis if needed
      if (start > 2) pages.push('...');
      
      // Add pages around current
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      // Add ellipsis if needed
      if (end < total - 1) pages.push('...');
      
      // Always show last page if there is more than one page
      if (total > 1) pages.push(total);
      
      return pages;
    },
    
    get activeKeys() {
      return this.keys.filter(k => !this.isExpired(k)).length;
    },

    get expiredKeys() {
      return this.keys.filter(k => this.isExpired(k)).length;
    },

    get usedKeys() {
      return this.keys.filter(k => k.activatedDevices && k.activatedDevices.length > 0).length;
    },

    get totalDevices() {
      return this.keys.reduce((total, k) => total + (k.activatedDevices?.length || 0), 0);
    },

    // Methods
    async login() {
      try {
        if (!this.username || !this.password) {
          Swal.fire('Lỗi', 'Vui lòng nhập đầy đủ thông tin đăng nhập', 'warning');
          return;
        }

        const res = await fetch('https://dangkhoaios.site/api/auth/login', {
          method: 'POST', 
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({username: this.username, password: this.password})
        });
        
        const data = await res.json();
        
        if (data.token) {
          this.token = data.token; 
          this.isLoggedIn = true;
          await this.loadPackages(); 
          await this.loadKeys();
          
          Swal.fire({
            title: 'Thành công!',
            text: 'Đăng nhập admin thành công',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
          });
        } else {
          Swal.fire('Lỗi', data.message || 'Sai tài khoản hoặc mật khẩu', 'error');
        }
      } catch (error) {
        console.error('Login error:', error);
        Swal.fire('Lỗi', 'Không thể kết nối đến server', 'error');
      }
    },

    logout() { 
      this.isLoggedIn = false; 
      this.token = ''; 
      this.username = '';
      this.password = '';
      this.currentPage = 1;
    },

    async createPackage() {
      if (!this.newPkgName) {
        Swal.fire('Lỗi', 'Nhập tên app', 'warning');
        return;
      }
      
      try {
        const res = await fetch('https://dangkhoaios.site/api/packages/create', {
          method: 'POST', 
          headers: {
            'Content-Type':'application/json', 
            'Authorization': `Bearer ${this.token}`
          },
          body: JSON.stringify({name: this.newPkgName})
        });
        
        const data = await res.json();
        
        if (data.success) {
          this.packages = [...this.packages, data.data];
          
          Swal.fire({
            title: 'Thành công!',
            html: `Package đã được tạo<br><strong>Token:</strong> <code class="text-sm">${data.data.token}</code>`,
            icon: 'success',
            confirmButtonText: 'OK'
          });
          
          this.newPkgName = '';
        } else {
          Swal.fire('Lỗi', data.message || 'Không thể tạo package', 'error');
        }
      } catch (error) {
        console.error('Create package error:', error);
        Swal.fire('Lỗi', 'Không thể kết nối đến server', 'error');
      }
    },

    async deletePackage(id) {
      if (!confirm('Xóa package này? Tất cả key liên quan sẽ bị ảnh hưởng.')) return;
      
      try {
        const res = await fetch(`https://dangkhoaios.site/api/packages/${id}`, {
          method: 'DELETE', 
          headers: {'Authorization': `Bearer ${this.token}`}
        });
        
        const data = await res.json();
        
        if (data.success) {
          this.packages = this.packages.filter(p => p._id !== id);
          await this.loadKeys();
          
          Swal.fire('Đã xóa!', 'Package đã được xóa', 'success');
        } else {
          Swal.fire('Lỗi', data.message || 'Không thể xóa package', 'error');
        }
      } catch (error) {
        console.error('Delete package error:', error);
        Swal.fire('Lỗi', 'Không thể kết nối đến server', 'error');
      }
    },

    async createKey() {
      if (!this.selectedPkg) {
        Swal.fire('Lỗi', 'Chọn Package', 'warning');
        return;
      }

      if (!this.keyPrefix || !this.keyQuantity || !this.duration || !this.maxDevices) {
        Swal.fire('Lỗi', 'Vui lòng điền đầy đủ thông tin', 'warning');
        return;
      }
      
      try {
        const res = await fetch('https://dangkhoaios.site/api/keys/create', {
          method: 'POST', 
          headers: {
            'Content-Type':'application/json', 
            'Authorization': `Bearer ${this.token}`
          },
          body: JSON.stringify({
            keyType: 'prefix', 
            prefix: this.keyPrefix, 
            quantity: parseInt(this.keyQuantity),
            packageId: this.selectedPkg, 
            duration: parseInt(this.duration), 
            durationType: this.durationType,
            multiActivation: this.multiDevice, 
            maxActivations: this.multiDevice ? parseInt(this.maxDevices) : 1
          })
        });
        
        const data = await res.json();
        
        if (data.success) {
          await this.loadKeys();
          
          Swal.fire({
            title: 'Tạo key thành công!',
            html: `<strong>Key đầu tiên:</strong> <code class="text-sm">${data.data[0].key}</code>`,
            icon: 'success',
            confirmButtonText: 'OK'
          });

          // Reset form
          this.keyPrefix = '';
          this.keyQuantity = '';
          this.duration = '';
          this.maxDevices = '';
        } else {
          Swal.fire('Lỗi', data.message || 'Không thể tạo key', 'error');
        }
      } catch (error) {
        console.error('Create key error:', error);
        Swal.fire('Lỗi', 'Không thể kết nối đến server', 'error');
      }
    },

    async loadPackages() {
      try {
        const res = await fetch('https://dangkhoaios.site/api/packages/list', {
          headers: {'Authorization': `Bearer ${this.token}`}
        });
        
        const data = await res.json();
        this.packages = data.data || [];
      } catch (error) {
        console.error('Load packages error:', error);
        Swal.fire('Lỗi', 'Không thể tải danh sách package', 'error');
      }
    },

    async loadKeys() {
      try {
        const res = await fetch('https://dangkhoaios.site/api/keys/list', {
          headers: {'Authorization': `Bearer ${this.token}`}
        });
        
        const data = await res.json();
        this.keys = data.data || [];
        this.currentPage = 1; // Reset to first page when loading new keys
      } catch (error) {
        console.error('Load keys error:', error);
        Swal.fire('Lỗi', 'Không thể tải danh sách key', 'error');
      }
    },

    async resetKey(id) {
      if (!confirm('Reset key này? Tất cả thiết bị đã kích hoạt sẽ bị xóa.')) return;
      
      try {
        const res = await fetch(`https://dangkhoaios.site/api/keys/${id}/reset`, {
          method: 'POST', 
          headers: {'Authorization': `Bearer ${this.token}`}
        });
        
        if (res.ok) {
          await this.loadKeys();
          Swal.fire('Đã reset!', 'Key đã được reset thành công', 'success');
        } else {
          Swal.fire('Lỗi', 'Không thể reset key', 'error');
        }
      } catch (error) {
        console.error('Reset key error:', error);
        Swal.fire('Lỗi', 'Không thể reset key', 'error');
      }
    },

    async deleteKey(id) {
      if (!confirm('Xóa vĩnh viễn key này?')) return;
      
      try {
        const res = await fetch(`https://dangkhoaios.site/api/keys/${id}`, {
          method: 'DELETE', 
          headers: {'Authorization': `Bearer ${this.token}`}
        });
        
        if (res.ok) {
          await this.loadKeys();
          Swal.fire('Đã xóa!', 'Key đã được xóa', 'success');
        } else {
          Swal.fire('Lỗi', 'Không thể xóa key', 'error');
        }
      } catch (error) {
        console.error('Delete key error:', error);
        Swal.fire('Lỗi', 'Không thể xóa key', 'error');
      }
    },

    copyKey(key) {
      navigator.clipboard.writeText(key);
      Swal.fire({
        title: 'Đã copy!',
        html: `<code class="text-sm">${key}</code>`,
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });
    },
    
    copyToken(token) {
      navigator.clipboard.writeText(token);
      Swal.fire({
        title: 'Đã copy token!',
        html: `<code class="text-sm">${token}</code>`,
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });
    },

    formatDate(date) {
      if (!date) return 'Vĩnh viễn';
      
      const now = new Date();
      const expDate = new Date(date);
      
      // If date is more than 10 years in the future, consider it permanent
      if (expDate.getTime() - now.getTime() > 10 * 365 * 24 * 60 * 60 * 1000) {
        return 'Vĩnh viễn';
      }
      
      return expDate.toLocaleString('vi-VN');
    },

    isExpired(k) {
      if (!k.expiresAt) return false;
      return new Date() > new Date(k.expiresAt);
    },

    // Watch for changes that should reset pagination
    watch: {
      searchKey() {
        this.currentPage = 1;
      },
      pageSize() {
        this.currentPage = 1;
      }
    },

    // Initialize
    init() {
      // Check if user is already logged in (from localStorage)
      const savedToken = localStorage.getItem('adminToken');
      const savedUsername = localStorage.getItem('adminUsername');
      
      if (savedToken && savedUsername) {
        this.token = savedToken;
        this.username = savedUsername;
        this.isLoggedIn = true;
        this.loadPackages();
        this.loadKeys();
      }
    }
  }
}

// Initialize the app when Alpine is ready
document.addEventListener('alpine:init', () => {
  Alpine.data('app', app);
});