
export async function waitForPromise(p:Promise<any>, timeout:number): Promise<({hadTimeout:boolean, value:any[]})> {

    const wrap = (op:Promise<any>, isTmeoutPromise:boolean) => new Promise<any>((resolve, reject) =>{
        op.then((...args:any[]) => resolve({hadTimeout:isTmeoutPromise, value:args})).catch(reject);
    });

    let ret:({hadTimeout:boolean, value:any[]}) = await Promise.race([
        wrap(p, false)
        , wrap(callbackToPromise(x => setTimeout(x, timeout)), true)
    ]);

    return ret;
}

export function callbackToPromise(
    func:
        /*
        a function that maps a function with an arbitrary signature to void
        */
        (f:    (...args :any[])=> any
        ) => void
    ): Promise<any> {
    return new Promise((resolve, reject) => {
        try {
            func((x:any) => resolve(x));
        } catch (error) {
            reject(error);
        }
    });
}

export async function asyncSleep(time:number): Promise<void>{
    return await callbackToPromise(x => setTimeout(x, time));
}

