/*
 * Copyright (C) 2011-2012 VMware, Inc. All rights reserved.
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

package com.wavemaker.runtime.ws.salesforce.gen;

import javax.xml.ws.WebFault;

/**
 * This class was generated by the JAX-WS RI. JAX-WS RI 2.1.5-b03- Generated source version: 2.1
 */
@WebFault(name = "InvalidQueryLocatorFault", targetNamespace = "urn:fault.partner.soap.sforce.com")
public class InvalidQueryLocatorFault_Exception extends Exception {

    private static final long serialVersionUID = -5102819302771673619L;

    /**
     * Java type that goes as soapenv:Fault detail element.
     * 
     */
    private final InvalidQueryLocatorFault faultInfo;

    /**
     * 
     * @param faultInfo
     * @param message
     */
    public InvalidQueryLocatorFault_Exception(String message, InvalidQueryLocatorFault faultInfo) {
        super(message);
        this.faultInfo = faultInfo;
    }

    /**
     * 
     * @param faultInfo
     * @param message
     * @param cause
     */
    public InvalidQueryLocatorFault_Exception(String message, InvalidQueryLocatorFault faultInfo, Throwable cause) {
        super(message, cause);
        this.faultInfo = faultInfo;
    }

    /**
     * 
     * @return returns fault bean: com.wavemaker.runtime.ws.salesforce.gen.InvalidQueryLocatorFault
     */
    public InvalidQueryLocatorFault getFaultInfo() {
        return this.faultInfo;
    }

}
