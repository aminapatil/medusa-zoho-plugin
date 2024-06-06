class DataStore {
    private static instance: DataStore;
    private data: { [key: string]: any };
  
    private constructor() {
      this.data = {};
    }
  
    public static getInstance(): DataStore {
      if (!DataStore.instance) {
        DataStore.instance = new DataStore();
      }
      return DataStore.instance;
    }
  
    public set(key: string, value: any): void {
      this.data[key] = value;
    }
  
    public get(key: string): any {
      return this.data[key];
    }
  
    public delete(key: string): void {
      delete this.data[key];
    }
  
    public getAll(): { [key: string]: any } {
      return this.data;
    }
  }
  
  export default DataStore;
  