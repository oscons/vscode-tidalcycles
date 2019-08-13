
export function callbackToPromise(func:((cb:Function)=>any)): Promise<any> {
    return new Promise((resolve, reject) => {
        try {
            func((x:any) => resolve(x));
        } catch (error) {
            reject(error);
        }
    });
}

