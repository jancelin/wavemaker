/*
 *  Copyright (C) 2012 VMware, Inc. All rights reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package com.wavemaker.tools.data;


import net.sf.cglib.proxy.CallbackFilter;

import java.lang.reflect.Method;

public class CallbackFilterImpl implements CallbackFilter {
    @Override
    public int accept(Method method) {
        return 0;
    }

    @Override
    public boolean equals(Object o) {
        return false;
    }
}